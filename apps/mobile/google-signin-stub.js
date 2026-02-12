// Stub for @react-native-google-signin/google-signin in Expo Go
// The real module requires native code and only works in dev builds
module.exports = {
  GoogleSignin: {
    configure: () => {},
    hasPlayServices: async () => true,
    signIn: async () => { throw new Error('Google Sign-In nécessite un development build'); },
  },
  isSuccessResponse: () => false,
};
