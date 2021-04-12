# Pose Annotation

This repository contains a tool designed for high-speed 2d body pose annotation.

## Getting Started
This tool runs as a python web server with a web frontent. To start the server, run:
```
python run.py --port 8008 --debug
```
and navigate to `http://localhost:8008/`

## Data
The data should be stored in the repo folder, with the following structure:
```
pose_annotation
 - data
   - scenes
     - forbes-cafe-2019-01-22_0
       - annotations.json
       - images
         - 000001.jpg
         - 000002.jpg
         - ...
     - gates-basement-elevators-2019-01-17_1
       - annotations.json
       - images
         - 000001.jpg
         - 000002.jpg
         - ...
     - ...

```
In the above example, `forbes-cafe-2019-01-22_0` is one scene which is being annotated. The file `annotations.json` stores 2d keypoint annotations in the COCO format.
