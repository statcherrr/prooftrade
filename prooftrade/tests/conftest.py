import os
import sys

# Add the package directory to path so `prooftrade.engine` is importable
# conftest is at prooftrade/prooftrade/tests/conftest.py
# package is at prooftrade/prooftrade/
_package_dir = os.path.dirname(os.path.abspath(__file__))
if _package_dir not in sys.path:
    sys.path.insert(0, _package_dir)