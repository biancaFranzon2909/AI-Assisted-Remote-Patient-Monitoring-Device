export default class TimeStamps {
  private readonly timezone: string = "UTC";
  private readonly locale: string = "pt-BR";
  readonly dateObj: Date;
  
  constructor() {
    this.dateObj = new Date(
      new Date()
      .toLocaleString(
        this.locale, 
        { timeZone: this.timezone }
      )
    );  
  }

  /**
   * Retorna um objeto com as propriedades `from` e `to`, 
   * representando o início e o fim do dia da data
   * se nao fornecido retorna o dia atual
   */
  getRangeDate(date?: Date): {from: Date, to: Date} {
    if (date) {
      this.dateObj.setTime(date.getTime());
    }
    
    let ret = {
      from: new Date(this.dateObj.setUTCHours(0, 0, 0, 0)),
      to: new Date(this.dateObj.setUTCHours(23, 59, 59, 999)),
    }

    return ret
  }

  // Literalmente um desperdício de código, mas substitui as chamadas de hoje
  // Serve para pegar dias específicos como hoje ou ontem
  getDia(offset: number = 0): Date {
    const dia = new Date();
    dia.setDate(dia.getDate() - offset);
    return dia
  }

  /**
   * Retorna um range do mes do ano inserido ate o mes posterior do ano
   * default: mes passado ate primeiro dia mes atual
   * Ex: Se ano = 2026 e mes = 08. Retorno {from: 01-08-2026, to: 01-09-2026}
   */ 
  // revisar usos
  getRangeMonth(ano?: number, mes?: number, offsetMes: number = -1): {from: Date, to: Date} {
    const hoje = new Date();
    const anoAtual = ano ?? hoje.getFullYear();
    const mesAtual = mes ?? hoje.getMonth();

    const from = new Date(Date.UTC(anoAtual, mesAtual + offsetMes, 1, 0, 0, 0));
    const to = new Date(Date.UTC(anoAtual, mesAtual + offsetMes + 1, 1, 0, 0, 0));

    return { from, to }
  }


  // Retorna o range do início do ano até o fim, se não informado retorna o ano atual
  getRangeYear(ano?: number): { from: Date, to: Date } {
    const hoje = new Date();
    const anoAtual = ano ?? hoje.getFullYear();
    return {
      from: new Date(Date.UTC(anoAtual, 0, 1, 0, 0, 0)),
      to: new Date(Date.UTC(anoAtual + 1, 0, 1, 0, 0, 0))
    }
  }

  /**
   * Formata um tempo decimal de hora e minutos para "HH:mm" \
   * @param 89.50
   * @returns {string} 89:30
   */
  getWatchHour(horasDecimais: number): string {
    const sinal = horasDecimais < 0 ? "-" : "";
    const valorAbsoluto = Math.abs(horasDecimais);
    const horas = Math.floor(valorAbsoluto);
    const minutos = Math.round((valorAbsoluto - horas) * 60);
    return `${sinal}${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
  }
}
