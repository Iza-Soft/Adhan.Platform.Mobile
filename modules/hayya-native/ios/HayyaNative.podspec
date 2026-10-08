Pod::Spec.new do |s|
  s.name           = 'HayyaNative'
  s.version        = '0.2.0'
  s.summary        = 'Native helpers for the Hayya app (sounds for notifications on iPhone)'
  s.description    = 'Converts the user own sounds to a format iOS accepts for notification sounds.'
  s.license        = 'MIT'
  s.author         = 'Ilko Adamov'
  s.homepage       = 'https://github.com/ilkoadamov'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
