const quat1 = new THREE.Quaternion();

export function fabrikIter(bones, target, pole) {
    let n = bones.length;

    let base_pos = bones[0].clone();
    let bases = bones.slice(0, -1);

    let distances = bases.map((bone, i) => {
        return bone.distanceTo(bones[i + 1]);
    });
    let total_length = distances.reduce((a, b) => a + b, 0);
    let dist = bones[0].distanceTo(target);

    if (dist > total_length) {
        // Target unreachable: stretch straight toward target
        for (let i = 0; i < n - 1; i++) {
            let pos = bones[i];
            let r = pos.distanceTo(target);
            let lambda = distances[i] / r;
            bones[i + 1].copy(
                bones[i].clone().multiplyScalar(1 - lambda).add(target.clone().multiplyScalar(lambda))
            );
        }
    } else {
        let diff = target.distanceTo(bones[n - 1]);
        const TOLERANCE = 0.001;
        let max_iterations = 100;
        while (diff > TOLERANCE && max_iterations > 0) {
            // Backward pass (tip -> root)
            bones[n - 1].copy(target);
            for (let i = n - 2; i >= 0; i--) {
                let p = bones[i];
                let p2 = bones[i + 1];
                let r = p.distanceTo(p2);
                let lambda = distances[i] / (r || 0.0001);
                bones[i].copy(
                    p2.clone().multiplyScalar(1 - lambda).add(p.clone().multiplyScalar(lambda))
                );
            }

            // Forward pass (root -> tip)
            bones[0].copy(base_pos);
            for (let i = 0; i < n - 1; i++) {
                let p = bones[i];
                let p2 = bones[i + 1];
                let r = p.distanceTo(p2);
                let lambda = distances[i] / (r || 0.0001);
                bones[i + 1].copy(
                    p.clone().multiplyScalar(1 - lambda).add(p2.clone().multiplyScalar(lambda))
                );
            }

            diff = target.distanceTo(bones[n - 1]);
            max_iterations--;
        }
    }

    // --- Pole Vector Alignment (Applied Post-Solve) ---
    // Only applies to chains with intermediate joints (n > 2) and need to bend to reach the target (dist < total_length)
    if (pole && n > 2 && dist < total_length) {
        let root = bones[0];
        let tip = bones[n - 1];

        let line_dir = tip.clone().sub(root).normalize();
        if (line_dir.lengthSq() < 1e-6) return;

        // Choose a key joint (usually middle joint) to determine current bend direction
        let mid_pos = bones[Math.floor((n - 1) / 2)];

        // Project current mid joint onto line root->tip
        let proj_mid = root.clone().add(
            line_dir.clone().multiplyScalar(mid_pos.clone().sub(root).dot(line_dir))
        );
        let current_plane_dir = mid_pos.clone().sub(proj_mid).normalize();

        // Project pole vector onto line root->tip plane
        let proj_pole = root.clone().add(
            line_dir.clone().multiplyScalar(pole.clone().sub(root).dot(line_dir))
        );
        let target_plane_dir = pole.clone().sub(proj_pole).normalize();

        // If both direction vectors are valid, rotate inner joints around root->tip axis
        if (current_plane_dir.lengthSq() > 1e-4 && target_plane_dir.lengthSq() > 1e-4) {
            let quaternion = quat1.setFromUnitVectors(current_plane_dir, target_plane_dir);

            for (let i = 1; i < n - 1; i++) {
                let offset = bones[i].clone().sub(root);
                offset.applyQuaternion(quaternion);
                bones[i].copy(root.clone().add(offset));
            }
        }
    }
}

