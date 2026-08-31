const toMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export const TIME_MARKS = [
  "8:10",
  "9:50",
  "11:30",
  "13:30",
  "15:30",
  "17:10",
  "18:50",
  "20:30",
];
export const GRID_START = 570;
export const GRID_END = 1330;
export const position = (time, start = GRID_START, end = GRID_END) =>
  `${((toMinutes(time) - start) / (end - start)) * 100}%`;
export const plural = (number, forms) =>
  forms[
    number % 100 >= 11 && number % 100 <= 14
      ? 2
      : number % 10 === 1
        ? 0
        : number % 10 >= 2 && number % 10 <= 4
          ? 1
          : 2
  ];
