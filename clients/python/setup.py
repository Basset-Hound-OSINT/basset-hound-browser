"""
Basset Hound Browser Python Client Setup
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="basset-hound-client",
    version="1.0.0",
    author="Basset Hound Team",
    author_email="team@bassethound.dev",
    description="Python client for Basset Hound Browser automation",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/basset-hound/browser",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Internet :: WWW/HTTP :: Browsers",
        "Topic :: Software Development :: Testing",
    ],
    python_requires=">=3.8",
    install_requires=[
        "websocket-client>=1.0.0",
    ],
    extras_require={
        "async": ["websockets>=10.0"],
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.20.0",
            "black>=23.0.0",
            "mypy>=1.0.0",
        ],
    },
    keywords="browser automation websocket osint scraping",
    project_urls={
        "Bug Reports": "https://github.com/basset-hound/browser/issues",
        "Source": "https://github.com/basset-hound/browser",
    },
)
