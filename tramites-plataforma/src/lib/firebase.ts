import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBu7lcX0yBzmqH4yUVBjsQoavCH3AbxBko",
  authDomain: "tramites-plataforma.firebaseapp.com",
  projectId: "tramites-plataforma",
  storageBucket: "tramites-plataforma.firebasestorage.app",
  messagingSenderId: "778021872362",
  appId: "1:778021872362:web:bd4f01da4d051939e02d93"
};

const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);