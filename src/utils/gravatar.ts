import md5 from 'md5';

export const getGravatarUrl = (email: string | undefined, size = 40) => {
  if (!email) return `https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&s=${size}`;
  const hash = md5(email.toLowerCase().trim());
  return `https://www.gravatar.com/avatar/${hash}?d=mp&s=${size}`;
}; 

// const getGravatarUrl = (email: string) => {
//   const hash = md5(email.toLowerCase().trim());
//   return `https://www.gravatar.com/avatar/${hash}?d=mp&s=40`;
// };