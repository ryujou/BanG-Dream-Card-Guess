import QRCode from "qrcode";
export function createQRCodeService() {
    return {
        createQrPayload(text) {
            return text;
        },
        createQrImage(text, options = {}) {
            return QRCode.toString(text, options);
        },
    };
}
export function createFakeQRCodeService(svg = "<svg></svg>") {
    return {
        createQrPayload(text) {
            return text;
        },
        async createQrImage() {
            return svg;
        },
    };
}
//# sourceMappingURL=qrcodeService.js.map