import { Jimp } from "jimp";
import { smartCrop } from "../crop.js";
export function createCropService() {
    return {
        async cropCard(buffer, settings, faceBoxes) {
            const image = await Jimp.read(buffer);
            const crop = await smartCrop(image, settings.cropSize, settings, [], faceBoxes);
            return { image, crop };
        },
        async recropCard(current, settings, cropHistory) {
            const round = isRoundWithSource(current);
            const image = await Jimp.read(round.sourceBuffer);
            return smartCrop(image, settings.cropSize, settings, cropHistory, round.faceBoxes);
        },
        validateCropResult(result) {
            return isCropLike(result);
        },
    };
}
export function createFakeCropService(crop = { x: 0, y: 0, image: "" }) {
    return {
        async cropCard() {
            return { image: { bitmap: { width: 100, height: 100 } }, crop };
        },
        async recropCard() {
            return crop;
        },
        validateCropResult(result) {
            return !!result;
        },
    };
}
function isCropLike(result) {
    return typeof result === "object" && result !== null
        && Number.isFinite(Number(result.x))
        && Number.isFinite(Number(result.y));
}
function isRoundWithSource(value) {
    if (typeof value === "object" && value !== null && Buffer.isBuffer(value.sourceBuffer)) {
        const faceBoxes = Array.isArray(value.faceBoxes)
            ? value.faceBoxes
            : [];
        return { sourceBuffer: value.sourceBuffer, faceBoxes };
    }
    throw new Error("Invalid current round");
}
//# sourceMappingURL=cropService.js.map