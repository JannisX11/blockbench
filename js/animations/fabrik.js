// Vec3[], Vec3
let old_spheres = []

function fabrikIter(bones, target) {
    let n = bones.length;
    let bases = bones.slice(0, -1);

    let distances = bases.map((bone, i) => {
        return bone.distanceTo(bones[i + 1]);
    });

    let dist = bones[0].distanceTo(target);

    if (dist > distances.reduce((partial, a) => partial + a, 0)) {
        for (i = 0; i < n - 1; i++) {
            let pos = bones[i];
            let r = pos.distanceTo(target);
            let lambda = distances[i] / r;
            bones[i + 1] = pos.clone().multiplyScalar(1 - lambda).add(target.clone().multiplyScalar(lambda));
        }
    } else {
        let b = bases[0];
        let diff = target.distanceTo(bones[n - 1]);
        const TOLERANCE = 0.001;
        while (diff > TOLERANCE) {
            bones[n - 1] = target;
            for (i = n - 2; i >= 0; i--) {
                let p = bones[i];
                let p2 = bones[i + 1];
                let r = p.distanceTo(p2);
                let lambda = distances[i] / r;
                bones[i] = p2.clone().multiplyScalar(1 - lambda).add(p.clone().multiplyScalar(lambda));
            }

            bones[0] = b;

            for (i = 0; i < n - 1; i++) {
                let p = bones[i];
                let p2 = bones[i + 1];
                let r = p.distanceTo(p2);
                let lambda = distances[i] / r;
                bones[i + 1] = p.clone().multiplyScalar(1 - lambda).add(p2.clone().multiplyScalar(lambda));
            }

            diff = target.distanceTo(bones[n - 1]);
        }
    }
}

