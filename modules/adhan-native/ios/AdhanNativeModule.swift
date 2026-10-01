import AVFoundation
import ExpoModulesCore

/**
 * Native частта на Езан за iPhone (етап 6): своите звуци на потребителя.
 *
 * iOS приема за звук на известие само файлове до 30 сек. във формат aiff, wav или caf
 * (некомпресиран звук), записани в Library/Sounds на приложението. Затова избраният
 * mp3 / m4a / mp4 / wav се преобразува тук в .caf (16 бита, моно, 22 050 Hz).
 */
public class AdhanNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AdhanNative")

    // Дължината на звуков файл в секунди; −1 – не е звук или не може да се прочете.
    AsyncFunction("getAudioDuration") { (uri: String) async -> Double in
      let asset = AVURLAsset(url: Self.fileURL(uri))
      guard let tracks = try? await asset.loadTracks(withMediaType: .audio), !tracks.isEmpty,
            let duration = try? await asset.load(.duration) else {
        return -1
      }
      let seconds = CMTimeGetSeconds(duration)
      return seconds.isFinite ? seconds : -1
    }

    // Преобразува файла в Library/Sounds/<name> (.caf, 16 бита, моно, 22 050 Hz).
    // Ако е по-дълъг от maxSec, го скъсява: реже на тиха пауза (мюезинът си поема дъх)
    // между 15-ата секунда и края, с плавно заглъхване; без пауза – на maxSec, с по-дълго заглъхване.
    // Връща { duration (на скъсения), originalDuration, trimmed, ok }.
    AsyncFunction("prepareNotificationSound") { (uri: String, name: String, maxSec: Double) async throws -> [String: Any] in
      let asset = AVURLAsset(url: Self.fileURL(uri))
      let tracks = try await asset.loadTracks(withMediaType: .audio)
      guard let track = tracks.first else {
        throw NoAudioException()
      }
      let original = CMTimeGetSeconds(try await asset.load(.duration))
      guard original.isFinite, original > 0.3 else {
        throw NoAudioException()
      }
      // с запас: много записи започват с тишина или въведение (при Мишари – 19 сек. тишина)
      var samples = try Self.readPCM(asset: asset, track: track, seconds: min(original, maxSec + 60))
      let start = Self.leadingSilence(samples)
      if start > 0 {
        samples.removeFirst(start)
      }
      let playable = original - Double(start) / Self.rate
      let (end, fade) = Self.cutPoint(samples, maxSec: maxSec)
      Self.fadeOut(&samples, end: end, length: fade)
      let dest = try Self.soundsDirectory().appendingPathComponent(name)
      try? FileManager.default.removeItem(at: dest)
      try Self.writeCAF(samples, count: end, to: dest)
      return [
        "duration": Double(end) / Self.rate,
        "originalDuration": original,
        "trimmed": playable > maxSec + 0.25,
        "ok": true,
      ]
    }

    Function("deleteNotificationSound") { (name: String) in
      if let dir = try? Self.soundsDirectory() {
        try? FileManager.default.removeItem(at: dir.appendingPathComponent(name))
      }
    }

    // Пътят до Library/Sounds (file://…) – за преслушване на своите звуци.
    Function("soundsDirectoryUri") { () -> String in
      (try? Self.soundsDirectory().absoluteString) ?? ""
    }
  }

  private static func fileURL(_ uri: String) -> URL {
    if uri.hasPrefix("file://"), let url = URL(string: uri) {
      return url
    }
    return URL(fileURLWithPath: uri)
  }

  private static func soundsDirectory() throws -> URL {
    let library = try FileManager.default.url(for: .libraryDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    let dir = library.appendingPathComponent("Sounds", isDirectory: true)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }

  private static let rate = 22050.0

  /** Всеки звук (mp3, m4a, mp4, wav…) → 16-битови семпли, моно, 22 050 Hz – първите `seconds`. */
  private static func readPCM(asset: AVURLAsset, track: AVAssetTrack, seconds: Double) throws -> [Int16] {
    let pcm: [String: Any] = [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVSampleRateKey: rate,
      AVNumberOfChannelsKey: 1,
      AVLinearPCMBitDepthKey: 16,
      AVLinearPCMIsFloatKey: false,
      AVLinearPCMIsBigEndianKey: false,
      AVLinearPCMIsNonInterleaved: false,
    ]
    let reader = try AVAssetReader(asset: asset)
    reader.timeRange = CMTimeRange(start: .zero, duration: CMTime(seconds: seconds, preferredTimescale: 600))
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: pcm)
    // add() хвърля Objective-C изключение, ако не може – проверка преди това
    guard reader.canAdd(output) else {
      throw ConversionException()
    }
    reader.add(output)
    guard reader.startReading() else {
      throw ConversionException()
    }
    var samples = [Int16]()
    samples.reserveCapacity(Int(rate * (seconds + 1)))
    while let buffer = output.copyNextSampleBuffer() {
      guard let block = CMSampleBufferGetDataBuffer(buffer) else { continue }
      let length = CMBlockBufferGetDataLength(block)
      if length < 2 { continue }
      var chunk = [Int16](repeating: 0, count: length / 2)
      let status = chunk.withUnsafeMutableBytes { raw -> OSStatus in
        guard let base = raw.baseAddress else { return -1 }
        return CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: raw.count, destination: base)
      }
      if status == noErr {
        samples.append(contentsOf: chunk)
      }
    }
    if reader.status == .failed || samples.isEmpty {
      throw ConversionException()
    }
    return samples
  }

  /** Колко семпла тишина има в началото (под 3% от най-силното място), с 50 мс запас. */
  private static func leadingSilence(_ s: [Int16]) -> Int {
    var peak = 0
    for v in s {
      let a = abs(Int(v))
      if a > peak { peak = a }
    }
    if peak == 0 { return 0 }
    let threshold = max(Double(peak) * 0.03, 200)
    let win = Int(rate / 50) // 20 мс
    var i = 0
    while i + win <= s.count {
      var sum = 0.0
      for k in i..<(i + win) {
        let v = Double(s[k])
        sum += v * v
      }
      if (sum / Double(win)).squareRoot() > threshold {
        return max(0, i - Int(0.05 * rate))
      }
      i += win
    }
    return 0
  }

  /**
   * Докъде да свири и колко семпла да заглъхва. До maxSec – целият звук.
   * По-дълъг: последната истинска пауза (тихо поне 150 мс) между 15-ата секунда и края –
   * първо дълбоките (под 12% от средната сила), после по-меките (под 35%); срез в средата
   * ѝ с 0,5 сек. заглъхване. Без пауза – срез на maxSec с 3 сек. заглъхване.
   */
  private static func cutPoint(_ s: [Int16], maxSec: Double) -> (Int, Int) {
    let maxN = Int(maxSec * rate)
    if s.count <= maxN {
      return (s.count, min(s.count, Int(0.01 * rate)))
    }
    let win = Int(rate / 10)
    let rms: (Int) -> Double = { start in
      var sum = 0.0
      for i in start..<min(start + win, s.count) {
        let v = Double(s[i])
        sum += v * v
      }
      return (sum / Double(win)).squareRoot()
    }
    var levels: [Double] = []
    var i = 0
    while i + win <= maxN {
      levels.append(rms(i))
      i += win / 2
    }
    let sorted = levels.sorted()
    let median = sorted.isEmpty ? 0 : sorted[sorted.count / 2]
    if median <= 0 {
      return (maxN, Int(3 * rate))
    }
    let from = Int(15 * rate)
    let to = maxN - win - win / 2
    var deep = -1
    var soft = -1
    var j = from
    while j <= to {
      let level = max(rms(j), rms(j + win / 2))
      if level < 0.12 * median {
        deep = j
      } else if level < 0.35 * median {
        soft = j
      }
      j += win / 2
    }
    let pick = deep >= 0 ? deep : soft
    if pick >= 0 {
      return (pick + (3 * win) / 4, Int(0.5 * rate))
    }
    return (maxN, Int(3 * rate))
  }

  private static func fadeOut(_ s: inout [Int16], end: Int, length: Int) {
    let n = min(length, end)
    if n <= 0 { return }
    for k in 0..<n {
      let g = 1 - Double(k + 1) / Double(n)
      let idx = end - n + k
      s[idx] = Int16(Double(s[idx]) * g * g)
    }
  }

  private static func writeCAF(_ samples: [Int16], count: Int, to dest: URL) throws {
    guard let format = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: rate, channels: 1, interleaved: true),
          let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count)),
          let channel = buffer.int16ChannelData else {
      throw ConversionException()
    }
    buffer.frameLength = AVAudioFrameCount(count)
    samples.withUnsafeBufferPointer { src in
      if let base = src.baseAddress {
        channel[0].update(from: base, count: count)
      }
    }
    do {
      let file = try AVAudioFile(forWriting: dest, settings: format.settings, commonFormat: .pcmFormatInt16, interleaved: true)
      try file.write(from: buffer)
    } catch {
      try? FileManager.default.removeItem(at: dest)
      throw ConversionException()
    }
  }
}

internal final class NoAudioException: Exception {
  override var reason: String {
    "The file has no audio"
  }
}

internal final class ConversionException: Exception {
  override var reason: String {
    "The sound could not be converted"
  }
}
