import jwt from "jsonwebtoken";

export const AUTH_COOKIE_NAME = "accessToken";

export function setAuthCookie(response, user, config, rememberMe = false) {
  const expiresIn = rememberMe ? config.jwtRememberMeExpiresIn : config.jwtExpiresIn;
  const maxAge = rememberMe ? config.jwtRememberMeMaxAge : config.jwtMaxAge;
  const token = jwt.sign(
    { sub: user.id, role: user.role, tokenVersion: user.tokenVersion },
    config.jwtSecret,
    { algorithm: "HS256", expiresIn },
  );
  response.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
}

export function clearAuthCookie(response, config) {
  response.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "strict",
    path: "/",
  });
}
