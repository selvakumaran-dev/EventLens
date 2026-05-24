/**
 * faceApiLoader.js
 * ──────────────────────────────────────────────────────────────────────────
 * Handles lazy loading of @vladmandic/face-api models.
 * Models are fetched from jsDelivr CDN (free, no server needed) or from a
 * local /public/models/ folder when VITE_FACE_API_MODEL_URL is set.
 *
 * Models used:
 *  • Guest (fast mobile):  TinyFaceDetector + FaceLandmark68Tiny + FaceRecognition
 *  • Admin (accurate):     SsdMobilenet + FaceLandmark68 + FaceRecognition
 */
import * as faceapi from '@vladmandic/face-api';

const MODEL_URL =
  import.meta.env.VITE_FACE_API_MODEL_URL ||
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';

let guestModelsLoaded = false;
let adminModelsLoaded = false;

/**
 * Load lightweight models optimized for mobile guest devices.
 * Tiny models trade slight accuracy for fast detection on mid-range phones.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function loadGuestModels() {
  if (guestModelsLoaded) return;

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);

  guestModelsLoaded = true;
  console.log('✅ face-api guest models loaded');
}

/**
 * Load accurate full-size models for the admin dashboard.
 * Runs on the photographer's powerful laptop — accuracy preferred.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function loadAdminModels() {
  if (adminModelsLoaded) return;

  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);

  adminModelsLoaded = true;
  console.log('✅ face-api admin models loaded');
}

/**
 * Detect a SINGLE face in a media element and return its 128-float descriptor.
 * Uses the tiny detector — fast enough for real-time selfie capture.
 *
 * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement} input
 * @returns {Float32Array|null}  descriptor or null if no face found
 */
export async function extractSingleDescriptor(input) {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });

  const detection = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks(true)   // true = use tiny 68-point model
    .withFaceDescriptor();

  return detection?.descriptor ?? null;
}

/**
 * Detect ALL faces in an image and return an array of 128-float descriptors.
 * Uses the full SSD Mobilenet for admin-quality accuracy.
 *
 * @param {HTMLImageElement|HTMLCanvasElement} input
 * @returns {Array<Float32Array>}  one descriptor per detected face
 */
export async function extractAllDescriptors(input) {
  const detections = await faceapi
    .detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  return detections.map((d) => d.descriptor);
}

export { faceapi };
