<?php
/**
 * Succulent Sphere — media upload endpoint for Hostinger.
 *
 * Receives exactly what src/lib/media-upload.ts -> uploadToHostinger() sends:
 *   multipart/form-data with fields: file, token, path
 * Responds with JSON: {"ok":true,"url":"https://<site>/<rel-path>","filename":"..."}
 * The Next.js side reads the "url" key (see extractUrl in media-upload.ts).
 *
 * Deploy (see hostinger/README.md):
 *   1. node scripts/build-upload-php.cjs   -> creates hostinger/upload.local.php
 *   2. Upload hostinger/upload.local.php to your site web root (public_html)
 *      via hPanel File Manager and rename it to upload.php
 *   3. HOSTINGER_UPLOAD_URL must be https://<your-site>/upload.php
 */
declare(strict_types=1);

// Must match HOSTINGER_UPLOAD_TOKEN in the Next.js environment (.env.local / Vercel).
define('UPLOAD_TOKEN', 'PASTE_HOSTINGER_UPLOAD_TOKEN_HERE');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

/** @param array<string, mixed> $body */
function fail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'POST only');
}

if (UPLOAD_TOKEN === '' || UPLOAD_TOKEN === 'PASTE_HOSTINGER_UPLOAD_TOKEN_HERE') {
    fail(500, 'UPLOAD_TOKEN is not configured in upload.php');
}

$token = (string) ($_POST['token'] ?? '');
if ($token === '' || !hash_equals(UPLOAD_TOKEN, $token)) {
    fail(401, 'Invalid token');
}

if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
    fail(400, 'No file provided');
}
$file = $_FILES['file'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    fail(400, 'Upload failed with PHP error code ' . (string) ($file['error'] ?? -1));
}
if ((int) $file['size'] <= 0 || (int) $file['size'] > 10 * 1024 * 1024) {
    fail(413, 'File must be between 1 byte and 10 MB');
}

/** @var array<string, string> $allowedExt */
$allowedExt = [
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png'  => 'image/png',
    'webp' => 'image/webp',
    'gif'  => 'image/gif',
    'avif' => 'image/avif',
];
$ext = strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION));
if (!isset($allowedExt[$ext])) {
    fail(415, 'Only jpg, jpeg, png, webp, gif and avif files are allowed');
}

// Verify the real content type (never trust the client-supplied name alone).
$mime = '';
if (function_exists('finfo_open')) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = (string) finfo_file($finfo, (string) $file['tmp_name']);
    finfo_close($finfo);
} elseif (function_exists('mime_content_type')) {
    $mime = (string) mime_content_type((string) $file['tmp_name']);
}
if ($mime !== '' && $mime !== $allowedExt[$ext]) {
    fail(415, 'File content does not match its extension');
}

/*
 * Resolve the target directory. The caller sends "path" like
 * "public_html/products/blog" — i.e. relative to the hosting account root,
 * where "public_html" IS this file's directory (the web root).
 */
$rawPath = str_replace('\\', '/', (string) ($_POST['path'] ?? 'uploads'));
if (strncasecmp($rawPath, 'public_html/', 12) === 0) {
    $rawPath = substr($rawPath, 12);
}
$segments = array_values(array_filter(
    explode('/', $rawPath),
    static function (string $part): bool {
        return $part !== '' && $part !== '.' && $part !== '..';
    }
));
if (count($segments) === 0) {
    $segments = ['uploads', 'misc'];
}

$webRoot = __DIR__;
$targetDir = $webRoot;
foreach ($segments as $segment) {
    $safeSegment = (string) preg_replace('/[^A-Za-z0-9 _-]/', '', $segment);
    if ($safeSegment === '') {
        fail(400, 'Invalid path segment');
    }
    $targetDir .= DIRECTORY_SEPARATOR . $safeSegment;
}
if (!is_dir($targetDir) && !@mkdir($targetDir, 0755, true) && !is_dir($targetDir)) {
    fail(500, 'Could not create the target directory');
}

/*
 * Defense in depth: block PHP execution inside image directories, so a
 * renamed script can never run from the uploads tree.
 */
$htaccess = $targetDir . DIRECTORY_SEPARATOR . '.htaccess';
if (!file_exists($htaccess)) {
    @file_put_contents(
        $htaccess,
        "<FilesMatch \"\\.(php|phtml|php[0-9]|pht)$\">\n  Require all denied\n</FilesMatch>\n"
    );
}

// Safe, unique filename (keep the original name when possible).
$base = (string) pathinfo((string) $file['name'], PATHINFO_FILENAME);
$base = trim((string) preg_replace('/[^A-Za-z0-9._-]+/', '-', $base), '-');
if ($base === '') {
    $base = 'image';
}
if (strlen($base) > 80) {
    $base = substr($base, 0, 80);
}
$filename = $base . '.' . $ext;
$targetPath = $targetDir . DIRECTORY_SEPARATOR . $filename;
if (file_exists($targetPath)) {
    $filename = $base . '-' . substr((string) uniqid(), -6) . '.' . $ext;
    $targetPath = $targetDir . DIRECTORY_SEPARATOR . $filename;
}
if (!@move_uploaded_file((string) $file['tmp_name'], $targetPath)) {
    fail(500, 'Could not save the uploaded file');
}
@chmod($targetPath, 0644);

$scheme = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') ? 'https' : 'http';
$host = (string) ($_SERVER['HTTP_HOST'] ?? '');
$relative = str_replace($webRoot . DIRECTORY_SEPARATOR, '', $targetPath);
$url = $scheme . '://' . $host . '/' . str_replace(DIRECTORY_SEPARATOR, '/', $relative);

echo json_encode(['ok' => true, 'url' => $url, 'filename' => $filename]);
