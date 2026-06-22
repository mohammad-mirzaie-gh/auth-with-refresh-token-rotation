import bcrypt from 'bcrypt';

export const bcryptHash = async (raw: string): Promise<string> => {
  return bcrypt.hash(raw, 11);
};

export const bcryptCompare = async (
  raw: string,
  hash: string,
): Promise<boolean> => {
  return bcrypt.compare(raw, hash);
};
