import cv2
import numpy as np
import sys
import os

def dark_channel(img, patch_size=15):
    b, g, r = cv2.split(img)
    min_channel = cv2.min(cv2.min(b, g), r)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (patch_size, patch_size))
    return cv2.erode(min_channel, kernel)

def estimate_atmospheric_light(img, dark):
    h, w = img.shape[:2]
    num_pixels = h * w
    num_search = max(1000, num_pixels // 1000)
    flat_dark = dark.ravel()
    indices = np.argpartition(flat_dark, -num_search)[-num_search:]

    flat_img = img.reshape(-1, 3)
    brightness = np.sum(flat_img[indices], axis=1)
    brightest_idx = indices[np.argmax(brightness)]
    return img[brightest_idx // w, brightest_idx % w]

def dehaze(img, patch_size=15, omega=0.85, t0=0.1):
    img_f = img.astype(np.float64) / 255.0
    dark = dark_channel(img, patch_size)
    A = estimate_atmospheric_light(img_f, dark)
    A = np.clip(A, 0, 1)

    transmission = 1.0 - omega * (dark.astype(np.float64) / 255.0)
    transmission = np.clip(transmission, t0, 1.0)

    result = np.zeros_like(img_f)
    for i in range(3):
        result[:, :, i] = (img_f[:, :, i] - A[i]) / transmission + A[i]

    result = np.clip(result * 255, 0, 255).astype(np.uint8)
    return result

def enhance(input_path, output_path):
    img = cv2.imread(input_path)
    if img is None:
        print("ERROR: Could not read image", flush=True)
        return False

    h, w = img.shape[:2]
    orig_size = (w, h)

    if max(h, w) > 2048:
        scale = 2048 / max(h, w)
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)

    # 1. Dehaze (reduces haze/cloudy appearance)
    dehazed = dehaze(img)

    # 2. Moderate CLAHE on LAB L-channel
    lab = cv2.cvtColor(dehazed, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=1.8, tileGridSize=(8, 8))
    l = clahe.apply(l)
    enhanced = cv2.merge([l, a, b])
    enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

    # 3. Unsharp masking (gentle sharpen)
    blurred = cv2.GaussianBlur(enhanced, (0, 0), 1.5)
    enhanced = cv2.addWeighted(enhanced, 1.5, blurred, -0.5, 0)

    # 4. Slight saturation boost
    hsv = cv2.cvtColor(enhanced, cv2.COLOR_BGR2HSV)
    hsv[:, :, 1] = np.clip(hsv[:, :, 1].astype(np.int16) * 1.15, 0, 255).astype(np.uint8)
    enhanced = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

    # 5. Edge-preserving denoise (reduces artifacts without blurring edges)
    enhanced = cv2.bilateralFilter(enhanced, 5, 30, 30)

    if max(h, w) > 2048:
        enhanced = cv2.resize(enhanced, orig_size, interpolation=cv2.INTER_LINEAR)

    # 6. Slight overall brightness normalization
    lab2 = cv2.cvtColor(enhanced, cv2.COLOR_BGR2LAB)
    l2 = lab2[:, :, 0].astype(np.float64)
    l2 = np.clip((l2 - l2.mean()) * 1.05 + l2.mean(), 0, 255).astype(np.uint8)
    lab2[:, :, 0] = l2
    enhanced = cv2.cvtColor(lab2, cv2.COLOR_LAB2BGR)

    cv2.imwrite(output_path, enhanced, [cv2.IMWRITE_PNG_COMPRESSION, 6])
    return True

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python cloud_removal.py <input_path> <output_path>", flush=True)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    success = enhance(input_path, output_path)
    if success:
        print(f"SUCCESS: {output_path}", flush=True)
        sys.exit(0)
    else:
        sys.exit(1)
