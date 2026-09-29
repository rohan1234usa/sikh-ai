// The web app's Firebase settings, and what they turn on. Nothing here imports
// the SDK, so any page can read them without shipping Firebase. The SDK lives
// in three modules, each loaded only where it is used:
//   app.ts        the shared app, pulled in by the two below
//   auth.ts       sign-in, loaded by AuthContext when it's needed
//   firestore.ts  Seva, shared chats and account chats

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Chats saved to the signed-in account (and shared links) need the chat
// section of firestore.rules live first; until the owner turns this on, every
// chat stays in the browser. Needs a real Firebase project too.
export const cloudChatsEnabled =
  process.env.NEXT_PUBLIC_CHAT_CLOUD === '1' && !!firebaseConfig.apiKey && !!firebaseConfig.projectId;
