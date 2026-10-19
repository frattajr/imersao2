// Agenda interna: calcula horários livres a partir do expediente configurado
// e dos agendamentos já feitos. Funciona sem Google Agenda.

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function partes(ts, fuso) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return {
    ano: +p.year, mes: +p.month, dia: +p.day, hora: +p.hour, min: +p.minute, seg: +p.second,
    diaSemana: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday),
  };
}

function deslocamento(ts, fuso) {
  const p = partes(ts, fuso);
  return Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.min, p.seg) - (ts - (ts % 1000));
}

// Converte data/hora "de parede" no fuso da empresa para um instante UTC.
export function instanteLocal(ano, mes, dia, hora, min, fuso) {
  const palpite = Date.UTC(ano, mes - 1, dia, hora, min);
  let ts = palpite - deslocamento(palpite, fuso);
  ts = palpite - deslocamento(ts, fuso); // corrige em virada de horário de verão
  return ts;
}

export function formatar(ts, fuso) {
  const p = partes(ts, fuso);
  const dd = String(p.dia).padStart(2, "0"), mm = String(p.mes).padStart(2, "0");
  const hh = String(p.hora).padStart(2, "0"), mi = String(p.min).padStart(2, "0");
  return `${DIAS[p.diaSemana]} ${dd}/${mm} às ${hh}:${mi}`;
}

export function agoraTexto(fuso, ts = Date.now()) {
  const p = partes(ts, fuso);
  return `${formatar(ts, fuso)} de ${p.ano}`;
}

const minutos = (hhmm) => {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return h * 60 + (m || 0);
};

export function conflita(inicio, fim, agendamentos) {
  return agendamentos.some((a) => a.status !== "cancelado" && inicio < Date.parse(a.fim) && fim > Date.parse(a.inicio));
}

export function dentroDoExpediente(ts, duracaoMin, empresa) {
  const { horario, negocio } = empresa;
  const p = partes(ts, negocio.fuso);
  const ini = p.hora * 60 + p.min;
  return horario.dias.includes(p.diaSemana) && ini >= minutos(horario.inicio) && ini + duracaoMin <= minutos(horario.fim);
}

export function horariosLivres(empresa, agendamentos, { duracao_min = 60, a_partir_de, limite = 6, por_dia = 2, agora = Date.now() } = {}) {
  const { horario, negocio } = empresa;
  const fuso = negocio.fuso;
  const minimo = Math.max(agora + (horario.antecedencia_horas || 0) * 3600e3, a_partir_de ? Date.parse(a_partir_de) || 0 : 0);
  const passo = Math.max(15, horario.passo_min || 60);
  const livres = [];
  for (let d = 0; d < 21 && livres.length < limite; d++) {
    const dia = partes(minimo + d * 86400e3, fuso);
    if (!horario.dias.includes(dia.diaSemana)) continue;
    let noDia = 0;
    for (let m = minutos(horario.inicio); m + duracao_min <= minutos(horario.fim); m += passo) {
      const ini = instanteLocal(dia.ano, dia.mes, dia.dia, Math.floor(m / 60), m % 60, fuso);
      const fim = ini + duracao_min * 60e3;
      if (ini < minimo || conflita(ini, fim, agendamentos)) continue;
      livres.push({ inicio: new Date(ini).toISOString(), texto: formatar(ini, fuso) });
      if (++noDia >= por_dia || livres.length >= limite) break;
    }
  }
  return livres;
}
