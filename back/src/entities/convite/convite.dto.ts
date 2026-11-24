export interface InviteUserDTO {
  nome: string;
  email: string;
  empresaId: string;
}

// esses são os dados usados no Token
export interface InviteTokenPayload {
  email: string;
  nome: string;
  idd: string;
}

export interface InviteAcceptDTO {
  idd: string;
  nome: string;
  nome_usuario: string;
  email: string;
  senha: string;
}
