import { parseDot, parseOdometer, parsePlate, parseVin } from '../src/ocr';

const today = new Date(2026, 9, 17);

test('DOT: pega os 4 últimos dígitos válidos', () => {
  expect(parseDot('DOT 4B7H XJ 3521', today)).toEqual({ week: 35, year: 2021 });
  expect(parseDot('DOT 1O19', today)).toEqual({ week: 10, year: 2019 });
});

test('DOT: rejeita semana inválida e ano futuro', () => {
  expect(parseDot('6021', today)).toBeNull();
  expect(parseDot('1230', today)).toBeNull();
});

test('placa antiga e Mercosul', () => {
  expect(parsePlate('ABC-1234')).toBe('ABC1234');
  expect(parsePlate('BRASIL ABC1D23')).toBe('ABC1D23');
  expect(parsePlate('sem placa')).toBeNull();
});

test('chassi sem I/O/Q', () => {
  expect(parseVin('9BWZZZ377VT004251')).toBe('9BWZZZ377VT004251');
  expect(parseVin('9BWZZZ377VT00425I')).toBeNull();
});

test('hodômetro', () => {
  expect(parseOdometer('TRIP 123.4  ODO 062.150 km')).toBe(62150);
  expect(parseOdometer('sem números')).toBeNull();
});
