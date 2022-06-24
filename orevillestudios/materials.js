let materialDirectoryCount = {};
let isMatGroupVisible = false;

// Create menu for right-click on groups
function createMaterialMenu() {    
    var bone_materials = getBoneMaterials();
        
    return {
        'name': 'Material Selection', 
        'icon': 'fa-fill-drip',
        'children' : bone_materials.map((material) => { 
            // Set Material Icons
            materialIcon = 'fa-droplet'

            // Set Remove Material icon to X
            if (material.value == null || material.value.length == 0)    {
                    materialIcon = 'fa-x'
            }

            return {
                icon : materialIcon,
                color : material.color,            
                name : material.name,
                click() {
                    // Build object of material counts
                    if (Object.keys(materialDirectoryCount).length === 0) {
                        countMaterialGroups();    
                    }
                    
                    // Cleanup empty groups
                    removeUnusedGroups();

                    // Get currently selected group
                    let selectedGroup = getCurrentGroup();

                    // Remove material from cube
                    if (material.value == "") {
                        // Move cuvbe to parent of current group
                        Outliner.selected.map((obj) => {
                            if (obj.title == 'Cube') {
                                obj.material = '';
                                obj.materialColor = '';
                                obj.addTo(selectedGroup.parent)
                            }
                        });

                        // remove material group
                        if (selectedGroup.parent != 'root') {
                            if (selectedGroup.children.length <= 0) {
                                selectedGroup.remove()
                            }
                        }
                    } else {
                        // Add material count
                        if (materialDirectoryCount[material.value] === NaN || materialDirectoryCount[material.value] === null) {
                            materialDirectoryCount[material.value] = 0
                        }
                        materialDirectoryCount[material.value] += 1;

                        // create new group to add materials to
                        let newMaterialGroup = new Group(material.value + materialDirectoryCount[material.value]).init();

                        if (selectedGroup.children[0].material == null) {
                                // Set group parent to group we just pushed to
                            newMaterialGroup.addTo(selectedGroup);
                            
                        } else {
                            // Set group to parent of group
                            newMaterialGroup.addTo(selectedGroup.parent);
                        }

                        newMaterialGroup.isOpen = true;
                        newMaterialGroup.materialValue = material.value

                        // Move cubes to new material group
                        Outliner.selected.map((obj) => {
                            if (obj.title == 'Cube') {
                                obj.material = material.value;
                                obj.materialColor = material.color;
                                obj.addTo(newMaterialGroup)

                                // remove material group if there are no children
                                if (selectedGroup.parent != 'root') {
                                    if (selectedGroup.children.length <= 0) {
                                        selectedGroup.remove()
                                    }
                                }
                            }
                        });
                    }
                }
            }
        }),
    }
}

// Count materials and add initilize them to materialDirectoryCount object
function countMaterialGroups() {
    getAllGroups().map((child) => {
        if (child.title == 'Group') {
            getBoneMaterials().map((mat) => {
                // dumb javascript thing
                if (materialDirectoryCount[mat.value] === undefined) {
                    materialDirectoryCount[mat.value] = 0
                }
                if (child.name.includes(mat.value)) {
                    // Increment material group count
                    materialDirectoryCount[mat.value] += 1;
                }        
            })
        }
    });
}

// Remove groups with zero children
function removeUnusedGroups() {
    allGroups = getAllGroups();
    allGroups.map((group) => {
        if (group.children.length == 0) {
            group.remove()
        }
    })
}

// Append single element to group menu
function appendToCubeMenu(element) {
    // Generate new group menu that includes out custom elements
    var originalMenu = Cube.prototype.menu
    Cube.prototype.menu = new Menu([
        ...originalMenu.structure,
        '_',
        element
    ]);
}

// Array of bone materials
function getBoneMaterials() {
    return [
        {
            "name" : "Alpha Test",
            "value" : "alphaTest",
            "color" : "red"
        },
        {
            "name" : "Alpha Blend",
            "value" : "alphaBlend",
            "color" : "orange"
        },
        {
            "name" : "Animated",
            "value" : "animated",
            "color" : "yellow"
        },
        {
            "name" : "Beacon Beam", 
            "value" : "beaconBeamTransparent",
            "color" : "green"
        }, 
        {
            "name" : "Charged",
            "value" : "charged",
            "color" : "teal"
        },
        {
            "name" : "Emissive",
            "value" : "emissive",
            "color" : "blue"
        }, 
        {
            "name" : "Emissive Alpha",
            "value" : "emissiveAlpha",
            "color" : "purple"
        },
        {
            "name" : "Opaque",
            "value" : "opaque",
            "color" : "pink"
        },
        {
            "name" : "Remove Material",
            "value" : "",
            "color" : ""
        }
    ]
}