#!/usr/bin/env python3
"""
Universal image OCR using PaddleOCR.

Usage:
    python ocr.py <image_path>
    python ocr.py --json <image_path>
    python ocr.py --lang en --json <image_path>

First run auto-installs PaddleOCR and dependencies (~500MB).
"""

import sys
import os
import json
import subprocess
import importlib
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SUPPORTED_EXTS = {'.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif', '.webp', '.gif'}


# ---------------------------------------------------------------------------
# Environment bootstrap
# ---------------------------------------------------------------------------

def find_python():
    """Find a usable python3 executable."""
    # Prefer the current interpreter
    if sys.executable:
        return sys.executable
    for name in ('python3', 'python'):
        path = shutil.which(name)
        if path:
            return path
    return None


def ensure_dependencies():
    """Check and auto-install PaddleOCR dependencies."""
    missing = []
    for pkg, import_name in [
        ('paddlepaddle', 'paddle'),
        ('paddleocr', 'paddleocr'),
    ]:
        try:
            importlib.import_module(import_name)
        except ImportError:
            missing.append(pkg)

    if not missing:
        return True

    print(f'[ocr] First run: installing {", ".join(missing)}...', file=sys.stderr)
    print('[ocr] This may take a few minutes (~500MB download).', file=sys.stderr)

    pip_args = [sys.executable, '-m', 'pip', 'install', '--quiet']

    for pkg in missing:
        print(f'[ocr] Installing {pkg}...', file=sys.stderr)
        try:
            subprocess.check_call(
                pip_args + [pkg],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
        except subprocess.CalledProcessError as e:
            stderr_out = e.stderr.decode('utf-8', errors='replace') if e.stderr else ''
            fail({
                'error': 'install_failed',
                'package': pkg,
                'message': f'Failed to install {pkg}. {stderr_out[:500]}',
            })
            return False

    print('[ocr] Dependencies installed successfully.', file=sys.stderr)
    return True


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def fail(obj):
    print(json.dumps(obj, ensure_ascii=False))
    sys.exit(1)


# ---------------------------------------------------------------------------
# OCR core
# ---------------------------------------------------------------------------

def run_ocr(image_path, lang='ch', json_mode=False):
    """Run PaddleOCR on the given image and output results."""
    # Suppress PaddleOCR's verbose logging
    os.environ['FLAGS_log_level'] = '3'

    # Import after dependency check
    from paddleocr import PaddleOCR

    # Initialize OCR engine (models auto-download on first use)
    ocr = PaddleOCR(
        use_angle_cls=True,
        lang=lang,
        show_log=False,
        use_gpu=False,
    )

    result = ocr.ocr(image_path, cls=True)

    if not result or not result[0]:
        if json_mode:
            print(json.dumps({
                'success': True,
                'file_path': os.path.abspath(image_path),
                'lang': lang,
                'line_count': 0,
                'char_count': 0,
                'lines': [],
                'text': '',
            }, ensure_ascii=False))
        else:
            print('[OCR] No text detected in image.')
        return

    lines_data = []
    text_lines = []

    for line in result[0]:
        box, (text, confidence) = line
        text_lines.append(text)
        lines_data.append({
            'text': text,
            'confidence': round(confidence, 4),
            'box': [[int(p[0]), int(p[1])] for p in box],
        })

    full_text = '\n'.join(text_lines)

    if json_mode:
        print(json.dumps({
            'success': True,
            'file_path': os.path.abspath(image_path),
            'lang': lang,
            'line_count': len(lines_data),
            'char_count': len(full_text),
            'lines': lines_data,
            'text': full_text,
        }, ensure_ascii=False))
    else:
        print(full_text)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    args = sys.argv[1:]

    # Parse flags
    json_mode = False
    lang = 'ch'
    output_file = None
    positional = []

    i = 0
    while i < len(args):
        if args[i] == '--json':
            json_mode = True
        elif args[i] == '--lang' and i + 1 < len(args):
            i += 1
            lang = args[i]
        elif args[i] == '--output' and i + 1 < len(args):
            i += 1
            output_file = args[i]
        elif not args[i].startswith('--'):
            positional.append(args[i])
        i += 1

    image_path = positional[0] if positional else None

    if not image_path:
        fail({'error': 'missing_arg', 'message': 'Usage: python ocr.py [--json] [--lang ch] <image_path>'})

    if not os.path.isfile(image_path):
        fail({'error': 'file_not_found', 'message': f'File not found: {image_path}'})

    ext = os.path.splitext(image_path)[1].lower()
    if ext not in SUPPORTED_EXTS:
        fail({
            'error': 'unsupported_format',
            'message': f'Unsupported image format: {ext}, supported: {", ".join(sorted(SUPPORTED_EXTS))}',
        })

    file_size = os.path.getsize(image_path)
    if file_size < 100:
        fail({'error': 'file_too_small', 'message': f'File too small ({file_size} bytes), may be corrupted.'})

    # Ensure dependencies
    if not ensure_dependencies():
        return

    # Redirect output to file if requested
    if output_file:
        original_stdout = sys.stdout
        sys.stdout = open(output_file, 'w', encoding='utf-8')

    try:
        run_ocr(image_path, lang=lang, json_mode=json_mode)
    except Exception as e:
        if output_file:
            sys.stdout.close()
            sys.stdout = original_stdout
        fail({'error': 'ocr_error', 'message': str(e)})

    if output_file:
        sys.stdout.close()
        sys.stdout = original_stdout
        print(json.dumps({
            'success': True,
            'output_file': os.path.abspath(output_file),
            'message': f'OCR result saved to {output_file}',
        }, ensure_ascii=False))


if __name__ == '__main__':
    main()
