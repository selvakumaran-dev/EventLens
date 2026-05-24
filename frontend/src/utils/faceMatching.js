/**
 * faceMatching.js
 * ──────────────────────────────────────────────────────────────────────────
 * Pure client-side vector search utilities.
 * No server calls, no heavy libs — just math on Float32Arrays / number[].
 *
 * Euclidean distance thresholds for face-api.js:
 *   < 0.35  → extremely confident same person
 *   < 0.45  → very confident same person
 *   < 0.55  → confident same person (recommended for events)
 *   < 0.60  → likely same person (default, more inclusive)
 *   > 0.60  → likely different people
 */

/**
 * Euclidean distance between two 128-dim descriptor vectors.
 * @param {number[]|Float32Array} a
 * @param {number[]|Float32Array} b
 * @returns {number}
 */
export function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Average multiple descriptor vectors into one stable composite vector.
 * Taking 3–5 selfie frames and averaging them dramatically reduces
 * noise from lighting, angle, and motion blur.
 *
 * @param {Float32Array[]} descriptors  — array of 128-float vectors
 * @returns {Float32Array}              — averaged descriptor
 */
export function averageDescriptors(descriptors) {
  if (descriptors.length === 0) throw new Error('No descriptors to average');
  if (descriptors.length === 1) return descriptors[0];

  const len = descriptors[0].length;
  const avg = new Float32Array(len);

  for (const desc of descriptors) {
    for (let i = 0; i < len; i++) {
      avg[i] += desc[i];
    }
  }

  for (let i = 0; i < len; i++) {
    avg[i] /= descriptors.length;
  }

  return avg;
}

/**
 * Minimum Euclidean distance between guestDescriptor and ALL face vectors
 * stored on a single photo. Works for group photos — every face detected
 * by the admin is stored, so any of them can match the guest.
 * Can accept either a single Float32Array or an array of Float32Arrays/arrays.
 *
 * @param {Float32Array|Float32Array[]} guestDescriptor
 * @param {Array<{vector: number[]}>} faceDescriptors  — from Photo doc
 * @returns {number} minimum distance (Infinity if no descriptors)
 */
export function minDistanceToPhoto(guestDescriptor, faceDescriptors) {
  if (!faceDescriptors || faceDescriptors.length === 0) return Infinity;

  let min = Infinity;
  const guestDescs = Array.isArray(guestDescriptor[0]) || guestDescriptor[0] instanceof Float32Array
    ? guestDescriptor
    : [guestDescriptor];

  for (const fd of faceDescriptors) {
    for (const gd of guestDescs) {
      const dist = euclideanDistance(gd, fd.vector);
      if (dist < min) min = dist;
    }
  }
  return min;
}

/**
 * Filter event photos to those containing the guest's face.
 *
 * Uses TWO thresholds:
 *  - STRICT (0.45): high-confidence matches shown first
 *  - LOOSE  (0.60): possible matches appended after
 *
 * Result: best matches first, possible matches after, no duplicates.
 *
 * @param {Float32Array} guestDescriptor
 * @param {Array}        photos            — full event photo array from API
 * @param {number}       strictThreshold   — default 0.45
 * @param {number}       looseThreshold    — default 0.60
 * @returns {{ strict: Array, loose: Array, all: Array }}
 */
export function findMatchingPhotos(
  guestDescriptor,
  photos,
  strictThreshold = 0.45,
  looseThreshold  = 0.60
) {
  const strict = [];
  const loose  = [];

  for (const photo of photos) {
    const dist = minDistanceToPhoto(guestDescriptor, photo.faceDescriptors);

    if (dist <= strictThreshold) {
      strict.push({ ...photo, _matchDistance: dist, _confidence: 'high' });
    } else if (dist <= looseThreshold) {
      loose.push({ ...photo, _matchDistance: dist, _confidence: 'possible' });
    }
  }

  // Sort each group: best match (lowest distance) first
  strict.sort((a, b) => a._matchDistance - b._matchDistance);
  loose.sort((a, b)  => a._matchDistance - b._matchDistance);

  return {
    strict,               // Definite matches
    loose,                // Possible matches
    all: [...strict, ...loose],  // Combined for display
  };
}

/**
 * Asynchronously filter event photos in a background Web Worker.
 * Prevents main thread blocking and lag on mobile browsers for large events.
 */
export function findMatchingPhotosAsync(
  guestDescriptor,
  photos,
  strictThreshold = 0.45,
  looseThreshold  = 0.60
) {
  return new Promise((resolve) => {
    // Standardize guestDescriptor into an array of serializable arrays
    const isMulti = Array.isArray(guestDescriptor[0]) || guestDescriptor[0] instanceof Float32Array;
    const descriptorsArray = isMulti
      ? Array.from(guestDescriptor).map(d => Array.from(d))
      : [Array.from(guestDescriptor)];

    // Construct the Web Worker code dynamically in an inline string
    const workerCode = `
      self.onmessage = function(e) {
        const { guestDescriptors, photos, strictThreshold, looseThreshold } = e.data;
        
        function euclideanDistance(a, b) {
          let sum = 0;
          for (let i = 0; i < a.length; i++) {
            const diff = a[i] - b[i];
            sum += diff * diff;
          }
          return Math.sqrt(sum);
        }

        function minDistanceToPhoto(guestDescs, faceDescs) {
          if (!faceDescs || faceDescs.length === 0) return Infinity;
          let min = Infinity;
          for (let i = 0; i < faceDescs.length; i++) {
            for (let j = 0; j < guestDescs.length; j++) {
              const dist = euclideanDistance(guestDescs[j], faceDescs[i].vector);
              if (dist < min) min = dist;
            }
          }
          return min;
        }

        const strict = [];
        const loose = [];

        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];
          const dist = minDistanceToPhoto(guestDescriptors, photo.faceDescriptors);

          if (dist <= strictThreshold) {
            strict.push({ ...photo, _matchDistance: dist, _confidence: 'high' });
          } else if (dist <= looseThreshold) {
            loose.push({ ...photo, _matchDistance: dist, _confidence: 'possible' });
          }
        }

        strict.sort((a, b) => a._matchDistance - b._matchDistance);
        loose.sort((a, b) => a._matchDistance - b._matchDistance);

        self.postMessage({
          strict,
          loose,
          all: [...strict, ...loose]
        });
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));

    worker.onmessage = (e) => {
      resolve(e.data);
      worker.terminate();
    };

    worker.postMessage({
      guestDescriptors: descriptorsArray,
      photos,
      strictThreshold,
      looseThreshold,
    });
  });
}
