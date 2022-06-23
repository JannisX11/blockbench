let materialDirectoryCount = {};
let isMatGroupVisible = false;

// Create menu for right-click on groups
function createMaterialMenu() {    
    var bone_materials = getBoneMaterials();

    return {
        'name': 'Material Selection', 
        'icon': 'bar_chart',
        'children' : bone_materials.map((material) => { return {
            icon : 'bubble_chart',
            color : material.color,            
            name : material.name,
            click() {
                // Get material array
                let materialsArray = getBoneMaterials();

                // Map all materials into materialDirectoryCount. 
                // This is needed so all material have a distinctive unique id
                materialsArray.map((mat) => {
                    materialDirectoryCount[mat.value] = 0;
                })
                
                // Loop over all groups in outliner
                countMaterialGroups(getAllGroups());

                // Get currently selected group
                let selectedGroup = getCurrentGroup();

                // Add material count
                materialDirectoryCount[material.value] += 1;

                // create new group to add materials to
                let newMaterialGroup = new Group(material.value + materialDirectoryCount[material.value]).init();

                // Set group parent to group we just pushed to
                newMaterialGroup.addTo(selectedGroup);
                
                // Open the group
                newMaterialGroup.isOpen = true;

                newMaterialGroup.materialValue = material.value

                // Move cubes to new material group
                Outliner.selected.map((obj) => {
                    if (obj.title == 'Cube') {
                        obj.material = material.value;
                        obj.materialColor = material.color;
                        obj.addTo(newMaterialGroup)
                    }
                });
            }
        }}),
    }
}

// Need to recursively search till we get to lowest level group
function countMaterialGroups(group) {
    let materialsArray = getBoneMaterials();
    
    //If group has children, check to see if there is a group in the children
    group.map((child) => {
        if (child.title == 'Group') {
            // add all
            materialsArray.map((mat) => {
                if (child.name.includes(mat.value)) {
                    materialDirectoryCount[mat.value] += 1;
                }        
            })
        }
    });
}

// Append single element to group menu
function appendToGroupMenu(element) {
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