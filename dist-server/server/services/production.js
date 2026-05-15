import path from "node:path";
import { createCardCache } from "./cardCache.js";
import { createCardProvider } from "./cardProvider.js";
import { createCropService } from "./cropService.js";
import { createNetworkService } from "./networkService.js";
import { createQRCodeService } from "./qrcodeService.js";
import { createRandomService } from "./randomService.js";
import { createScoreStore } from "./scoreStore.js";
import { createTimerService } from "./timerService.js";
export function createProductionServices(options) {
    const randomService = createRandomService();
    const timerService = createTimerService();
    const cardCache = createCardCache(options.cardCacheDir);
    const cropService = createCropService();
    const cardProvider = createCardProvider({
        cardsPath: path.join(options.resourceDir, "all5_2.json"),
        nicknamesPath: path.join(options.resourceDir, "nickname.json"),
        cardCache,
        cropService,
        randomService,
    });
    return {
        randomService,
        timerService,
        cardCache,
        cropService,
        cardProvider,
        scoreStore: createScoreStore(),
        qrcodeService: createQRCodeService(),
        networkService: createNetworkService(),
    };
}
