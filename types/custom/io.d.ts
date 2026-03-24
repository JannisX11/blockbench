declare global {
    function setupDragHandlers(): void;
    function loadModelFile(file: any, args: any): void;
    function loadImages(files: any, event: any): Promise<void>;
    function unsupportedFileFormatMessage(file_name: string): void;
    namespace Extruder {
        function drawImage(file: any): void;
        function startConversion(formResult: any): void;
    }
}

export {};
