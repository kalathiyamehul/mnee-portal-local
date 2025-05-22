import SHA256 from 'crypto-js/sha256';
import Hex from 'crypto-js/enc-hex';

export const getGravatarUrl = (email: string | undefined, size = 40) => {
  if (!email) return `https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&s=${size}`;
  const hash = SHA256(email.toLowerCase().trim()).toString(Hex);
  return `https://www.gravatar.com/avatar/${hash}?d=mp&s=${size}`;
}; 

// const getGravatarUrl = (email: string) => {
//   const hash = SHA256(email.toLowerCase().trim()).toString(Hex);
//   return `https://www.gravatar.com/avatar/${hash}?d=mp&s=40`;
// };