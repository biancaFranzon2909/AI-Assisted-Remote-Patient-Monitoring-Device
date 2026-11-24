import argon from "argon2";

const ARGON_OPTIONS = {
  type: argon.argon2id, // mais seguro: combina argon2i e argon2d
  memoryCost: 65536, // 64 MB
  timeCost: 3, // 3 iterações
  parallelism: 1,
  hashLength: 32,
} as const;

export const argon2 = {
  hash: async (senha: string): Promise<string> => {
    return await argon.hash(senha, ARGON_OPTIONS);
  },
  verify: async (hash: string, senha: string): Promise<boolean> => {
    return await argon.verify(hash, senha);
  },
};
