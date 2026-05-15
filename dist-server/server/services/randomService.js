export function createRandomService(random = Math.random) {
    return {
        pickOne(items) {
            if (!items.length)
                return undefined;
            return items[Math.floor(random() * items.length)];
        },
        shuffle(items) {
            const next = items.slice();
            for (let index = next.length - 1; index > 0; index -= 1) {
                const swapIndex = Math.floor(random() * (index + 1));
                [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
            }
            return next;
        },
        randomInt(min, max) {
            return Math.floor(random() * (max - min + 1)) + min;
        },
        random,
    };
}
export function createFakeRandomService(values = [0]) {
    let index = 0;
    return createRandomService(() => {
        const value = values[index % values.length] ?? 0;
        index += 1;
        return value;
    });
}
//# sourceMappingURL=randomService.js.map