declare global {
    namespace Clipbench {
        let elements: any[];
        enum types {
            text = 'text',
            display_slot = 'display_slot',
            keyframe = 'keyframe',
            animation = 'animation',
            face = 'face',
            mesh_selection = 'mesh_selection',
            texture = 'texture',
            layer = 'layer',
            outliner = 'outliner',
            texture_selection = 'texture_selection',
            image = 'image',
        }
        let image: undefined | {
            x: number,
            y: number,
            frame?: number
            data: string
        }
        namespace type_icons {
            let face = 'aspect_ratio';
            let mesh_selection = 'fa-gem';
            let outliner = 'fas.fa-cube';
        }
        function getCopyType(mode: any, check: any): Clipbench.types;
        function getPasteType(): Promise<Clipbench.types>;
        function copy(event: Event, cut: any): void;
        function paste(event: Event): Promise<void>;
        function setGroups(groups: Group[]): void;
        function setElements(arr: OutlinerElement[]): void;
        function setText(text: string): void;
        function setMeshSelection(mesh: Mesh): void;
        function pasteMeshSelection(): void;
        function pasteOutliner(event: Event): void;
        function pasteImage(): void;
    }
}

export {};
