export interface RandomService {
  pickOne<T>(items: T[]): T | undefined;
  shuffle<T>(items: T[]): T[];
  randomInt(min: number, max: number): number;
  random(): number;
}

export function createRandomService(random: () => number = Math.random): RandomService {
  return {
    pickOne<T>(items: T[]): T | undefined {
      if (!items.length) return undefined;
      return items[Math.floor(random() * items.length)];
    },
    shuffle<T>(items: T[]): T[] {
      const next = items.slice();
      for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      }
      return next;
    },
    randomInt(min: number, max: number): number {
      return Math.floor(random() * (max - min + 1)) + min;
    },
    random,
  };
}

export function createFakeRandomService(values: number[] = [0]): RandomService {
  let index = 0;
  return createRandomService(() => {
    const value = values[index % values.length] ?? 0;
    index += 1;
    return value;
  });
}

