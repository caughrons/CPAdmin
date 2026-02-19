import { decodeJwt, jwtVerify, SignJWT } from "jose";
import axios from "./axios";

const isValidToken = (accessToken) => {
  if (!accessToken) {
    return false;
  }

  const decoded = decodeJwt(accessToken);
  const currentTime = Date.now() / 1000;

  return decoded.exp > currentTime;
};

const setSession = (accessToken) => {
  if (accessToken) {
    localStorage.setItem("accessToken", accessToken);
    axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
  } else {
    localStorage.removeItem("accessToken");
    delete axios.defaults.headers.common.Authorization;
  }
};

const verify = async (token, secret) => {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret) // Secret needs to be Uint8Array
    );
    return payload;
  } catch (error) {
    console.error("Invalid token:", error);
    return null;
  }
};

const sign = async (payload, secret, options = {}) => {
  try {
    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(options.expiresIn || "1h")
      .setIssuedAt()
      .sign(new TextEncoder().encode(secret));
    return jwt;
  } catch (error) {
    console.error("Error signing token:", error);
    return null;
  }
};

export { isValidToken, setSession, verify, sign };
