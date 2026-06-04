# Mobile App Build & Deployment Guide

Complete guide for building and deploying the Basset Hound Mobile Dashboard to iOS and Android app stores.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [iOS Build & Distribution](#ios-build--distribution)
3. [Android Build & Distribution](#android-build--distribution)
4. [Version Management](#version-management)
5. [Release Process](#release-process)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- macOS 12+ (for iOS builds)
- Xcode 14+ (for iOS)
- Android Studio 2022+ (for Android)
- Node.js 18+
- npm/yarn

### Certificates & Accounts
- Apple Developer Account ($99/year)
- Google Play Developer Account ($25 one-time)
- Valid code signing certificates for iOS
- Provisioning profiles for development and distribution

### Installation

```bash
# Install CocoaPods (iOS dependency manager)
sudo gem install cocoapods

# Install Android SDK
# Via Android Studio > SDK Manager

# Install build tools
npm install -g @react-native-community/cli
```

## iOS Build & Distribution

### 1. Development Environment Setup

```bash
# Navigate to iOS directory
cd ios

# Install CocoaPods dependencies
pod install

# Return to root
cd ..
```

### 2. Code Signing

#### Automatic Code Signing (Recommended)
1. Open `ios/BassetHoundMobile.xcworkspace` in Xcode
2. Select "BassetHoundMobile" project
3. Select "BassetHoundMobile" target
4. Go to "Signing & Capabilities"
5. Enable "Automatically manage signing"
6. Select your development team

#### Manual Code Signing
1. Generate certificates in Apple Developer Portal
2. Download and install in Keychain
3. Create provisioning profiles
4. Configure in Xcode build settings

### 3. Building for Development

```bash
# Build and run on simulator
npm run ios:dev

# Build and run on specific device
react-native run-ios --device "iPhone 14 Pro"

# Build only (no launch)
npm start
# Then in Xcode: Product > Build
```

### 4. Building for TestFlight Beta

```bash
# Build archive
npm run ios:build

# Or manually in Xcode:
# 1. Select "Any iOS Device (arm64)" as build destination
# 2. Product > Archive
# 3. Distribute App > TestFlight

# Or use fastlane (advanced)
cd ios
fastlane beta
cd ..
```

**Manual Steps:**
1. Open `ios/BassetHoundMobile.xcworkspace` in Xcode
2. Select "BassetHoundMobile" target
3. Set build destination to "Any iOS Device (arm64)"
4. Product > Archive
5. Validate and upload to TestFlight
6. Invite beta testers in App Store Connect

### 5. Building for App Store Release

```bash
# Same as TestFlight build, but for production distribution:
cd ios
fastlane release
cd ..

# Or manually:
# 1. Increment version in Xcode
# 2. Product > Archive
# 3. Distribute App > App Store
# 4. Choose Release
# 5. Review and upload
```

### 6. App Store Connect Configuration

**App Information:**
- App Name: "Basset Hound Mobile"
- Bundle ID: "com.bassethound.mobile"
- Version: "1.0.0"
- Build Number: "1"

**Prepare for Submission:**
1. Add app icons (1024x1024 PNG)
2. Add app screenshots (multiple sizes for different devices)
3. Write app description (max 170 characters)
4. Add keywords (up to 100 characters)
5. Add release notes
6. Set content rating
7. Configure pricing
8. Select territories

**Screenshots Template:**
- iPhone 6.5" (Portrait): 1242x2688 pixels
- iPad 12.9" (Landscape): 2048x1536 pixels
- Create 2-5 screenshots per screen size showing key features

### 7. TestFlight Beta Testing

**Invite Beta Testers:**
1. Log in to App Store Connect
2. Select your app > TestFlight > Internal Testers
3. Add testers (email addresses)
4. Upload build
5. Wait for processing (15-30 minutes)
6. Testers receive email with TestFlight link

**Monitor Feedback:**
- TestFlight Reports > Crashes
- TestFlight Reports > Feedback
- Collect user feedback in-app or externally

## Android Build & Distribution

### 1. Development Environment Setup

```bash
# Set ANDROID_HOME (add to ~/.bashrc or ~/.zshrc)
export ANDROID_HOME=$HOME/Library/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Source the file
source ~/.bashrc
# or
source ~/.zshrc

# Verify setup
adb --version
```

### 2. Key Store Setup

**Create Release Keystore:**
```bash
# Generate keystore (one-time)
keytool -genkey -v -keystore ~/basset-hound.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias basset-hound-key \
  -storepass your-password \
  -keypass your-password

# Keep this safe - you'll need it for future builds!
```

**Store Credentials:**
```bash
# Create gradle.properties in ~/.gradle/
cat > ~/.gradle/gradle.properties << EOF
MYAPP_UPLOAD_STORE_FILE=/path/to/basset-hound.keystore
MYAPP_UPLOAD_STORE_PASSWORD=your-password
MYAPP_UPLOAD_KEY_ALIAS=basset-hound-key
MYAPP_UPLOAD_KEY_PASSWORD=your-password
EOF
```

### 3. Building for Development

```bash
# Build and run on Android Emulator
npm run android:dev

# Build and run on physical device (connect via USB)
react-native run-android --variant=debug

# Monitor logcat
adb logcat *:S ReactNative:V ReactNativeJS:V
```

### 4. Building for Google Play

```bash
# Build release APK
npm run android:build

# Or manually:
cd android
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
cd ..

# Build App Bundle (recommended for Play Store)
cd android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
cd ..

# Sign APK manually (if not auto-signed)
jarsigner -verbose -sigalg SHA1withRSA \
  -digestalg SHA1 \
  -keystore ~/basset-hound.keystore \
  android/app/build/outputs/apk/release/app-release.apk \
  basset-hound-key

# Verify APK signature
jarsigner -verify -verbose \
  android/app/build/outputs/apk/release/app-release.apk
```

### 5. Google Play Console Configuration

**Create App:**
1. Visit https://play.google.com/console
2. Create new app
3. Complete app details:
   - App name: "Basset Hound Mobile"
   - Default language: English (US)
   - App or game: App
   - Category: Productivity
   - Content rating: Complete questionnaire

**Store Listing:**
1. Add app title (50 characters max)
2. Add short description (80 characters max)
3. Add full description (4000 characters max)
4. Add app icon (512x512 PNG)
5. Add screenshots (2-8 per device type)
6. Add feature graphic (1024x500 PNG, landscape)
7. Add video (optional, up to 30 seconds)

**Graphics & Content:**
- App Icon: 512x512 PNG
- Screenshots: 1080x1920 (phone), 2560x1600 (tablet)
- Feature Graphic: 1024x500 PNG
- All must be published images

### 6. Upload to Google Play

**Internal Testing:**
1. Select "Internal testing" in left menu
2. Create new release
3. Upload app-release.aab or APK
4. Review app details
5. Invite testers (by email)
6. Confirm and release

**Closed Testing:**
1. Create testing track
2. Upload release
3. Invite limited testers
4. Collect feedback
5. Move to production when ready

**Production Release:**
1. Select "Production" in left menu
2. Create new release
3. Upload app-release.aab
4. Add release notes
5. Set rollout percentage (start with 5%, increase gradually)
6. Review compliance (data safety, ads, etc.)
7. Submit for review

### 7. Internal Testing & Monitoring

**Monitor Crashes:**
1. Google Play Console > Quality > Crashes & ANRs
2. View stack traces
3. Fix critical issues
4. Deploy new build

**Monitor User Feedback:**
1. Google Play Console > Reviews
2. Respond to user reviews
3. Address common concerns
4. Update app based on feedback

## Version Management

### Versioning Scheme
Follow semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Major feature additions or breaking changes
- **MINOR**: New features, no breaking changes
- **PATCH**: Bug fixes, improvements

Example: `1.2.3`

### Updating Versions

**iOS:**
1. Open `ios/BassetHoundMobile.xcodeproj/project.pbxproj`
2. Search for "MARKETING_VERSION" and update version
3. Search for "CURRENT_PROJECT_VERSION" and update build number

Or using Xcode:
1. Select project > Target > General
2. Update "Version" (marketing version)
3. Update "Build" (build number)

**Android:**
```gradle
// In android/app/build.gradle
android {
  defaultConfig {
    versionCode 1        // Build number - must increment for each release
    versionName "1.0.0"  // Marketing version
  }
}
```

### Build Number Strategy

```
Build Number = DateCode + Sequence
Example: 2024060101 = June 1, 2024, build 1

Or: Sequential (1, 2, 3, ...)
```

## Release Process

### Pre-Release Checklist

- [ ] Update version numbers (iOS and Android)
- [ ] Update CHANGELOG.md with new features/fixes
- [ ] Test on physical devices (iOS and Android)
- [ ] Test offline functionality
- [ ] Run test suite: `npm test`
- [ ] Check performance: `npm start` with Profiler
- [ ] Update app screenshots if needed
- [ ] Create release notes
- [ ] Tag release in git: `git tag v1.0.0`

### Release Steps

1. **Increment Versions**
   - iOS version and build number
   - Android versionCode and versionName
   - package.json version

2. **Build & Test**
   ```bash
   # Test on physical devices
   npm run ios:dev
   npm run android:dev
   
   # Run full test suite
   npm test
   ```

3. **Build Release Artifacts**
   ```bash
   # iOS
   npm run ios:build
   
   # Android
   npm run android:build
   ```

4. **Upload to TestFlight (iOS)**
   - App Store Connect > TestFlight
   - Upload archive
   - Invite beta testers
   - Collect feedback (1-2 weeks)

5. **Upload to Google Play (Android)**
   - Google Play Console > Internal Testing
   - Upload AAB/APK
   - Monitor for crashes
   - Gradually roll out: 5% → 25% → 100%

6. **Monitor Releases**
   ```bash
   # iOS
   # App Store Connect > Activity
   
   # Android
   # Google Play Console > Releases
   ```

7. **Production Rollout**
   - Start with staged rollout (if Android)
   - Monitor crash rates
   - Monitor user ratings
   - Be prepared to rollback if needed

### Rollback Procedure

**iOS:**
1. App Store Connect > Version Release
2. Select problematic version
3. Remove from sale
4. Upload previous working build
5. Submit for review again

**Android:**
1. Google Play Console > Releases > Production
2. View roll-out status
3. Pause roll-out (if <100%)
4. Create new release with fix
5. Deploy new build

## Troubleshooting

### iOS Build Issues

**"No provisioning profile found"**
```bash
# Re-enable automatic signing
# In Xcode: Signing & Capabilities > Automatically manage signing
```

**"CocoaPods dependency error"**
```bash
cd ios
pod deintegrate
pod install
cd ..
```

**"Xcode build failed"**
```bash
# Clean and rebuild
rm -rf ~/Library/Developer/Xcode/DerivedData/*
cd ios && xcodebuild clean && cd ..
npm run ios:dev
```

### Android Build Issues

**"SDK not found"**
```bash
# Verify ANDROID_HOME
echo $ANDROID_HOME

# Install required SDK
android update sdk --no-ui --all --filter "android-33,build-tools-33.0.0"
```

**"Gradle build failed"**
```bash
cd android
./gradlew clean
./gradlew assembleRelease
cd ..
```

**"Keystore not found"**
```bash
# Verify keystore path in gradle.properties
cat ~/.gradle/gradle.properties

# Regenerate if needed
keytool -genkey -v -keystore ~/basset-hound.keystore ...
```

### Store Submission Issues

**"App rejected for policy violation"**
- Review submission reason
- Update privacy policy
- Update data safety info
- Address specific violations
- Resubmit

**"Build fails review for crashes"**
- Check crash logs in store console
- Reproduce and fix
- Test thoroughly
- Submit new build

**"Versioning conflict"**
- Ensure version is higher than previous
- Increment build number even for same marketing version
- Check version history in console

### Performance Issues

**"App is slow"**
```bash
# Profile with React Native Debugger
npm start -- --interactive

# Check console logs
adb logcat | grep "React"
```

**"High memory usage"**
- Review componentDidMount/useEffect cleanup
- Check for memory leaks
- Optimize large lists with FlatList
- Profile with Xcode Instruments

## Release Notes Template

```markdown
## Version 1.0.0 - Release Notes

### New Features
- Real-time competitor monitoring
- Advanced alert system
- Offline mode with data sync
- iOS and Android apps

### Improvements
- Better performance
- Improved UI/UX
- Dark/light theme support

### Bug Fixes
- Fixed WebSocket reconnection
- Fixed offline sync issues
- Fixed theme toggle bug

### Known Issues
- None at this time

### Download
- iOS: App Store
- Android: Google Play Store
```

## Support

For build and deployment issues:
1. Check React Native documentation
2. Review Xcode/Android Studio logs
3. Check platform-specific forums
4. Consult app store guidelines
