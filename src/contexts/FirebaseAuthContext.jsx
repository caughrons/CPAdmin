import React, { createContext, useEffect, useReducer } from "react";

import firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";

import { firebaseConfig } from "@/config";

const INITIALIZE = "INITIALIZE";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  firebase.firestore();
}

const initialState = {
  isAuthenticated: false,
  isInitialized: false,
  isAdmin: false,
  user: null,
};

const reducer = (state, action) => {
  if (action.type === INITIALIZE) {
    const { isAuthenticated, isAdmin, user } = action.payload;
    return {
      ...state,
      isAuthenticated,
      isInitialized: true,
      isAdmin,
      user,
    };
  }

  return state;
};

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        user.getIdTokenResult().then((tokenResult) => {
          const isAdmin = tokenResult.claims.admin === true;
          dispatch({
            type: INITIALIZE,
            payload: { isAuthenticated: true, isAdmin, user },
          });
        });
      } else {
        dispatch({
          type: INITIALIZE,
          payload: { isAuthenticated: false, isAdmin: false, user: null },
        });
      }
    });
    return unsubscribe;
  }, [dispatch]);

  const signIn = (email, password) =>
    firebase.auth().signInWithEmailAndPassword(email, password);

  const signOut = async () => {
    await firebase.auth().signOut();
  };

  const resetPassword = async (email) => {
    await firebase.auth().sendPasswordResetEmail(email);
  };

  const auth = { ...state.user };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        method: "firebase",
        user: {
          id: auth.uid,
          email: auth.email,
          displayName: auth.displayName,
          role: state.isAdmin ? "admin" : "user",
        },
        signIn,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext, AuthProvider };
