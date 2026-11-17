from setuptools import find_packages, setup

setup(
    name="prooftrade",
    version="0.1.0",
    packages=find_packages(where="."),
    package_dir={"": "."},
    python_requires=">=3.8",
    install_requires=[
        "pandas>=2.0",
        "numpy>=1.20",
    ],
)