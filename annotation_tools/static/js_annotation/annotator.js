let COLORS = [
  "#e6194b",  // red
  "#3cb44b",  // green
  "#ffe119",  // yellow
  "#0082c8",  // blue
  "#f58231",  // orange
  "#911eb4",  // purple
  "#46f0f0",  // cyan
  "#f032e6",  // magenta
  "#d2f53c",  // lime
  "#fabebe",  // pink
  "#008080",  // teal
  "#e6beff",  // lavender
  "#aa6e28",  // brown
  "#fffac8",  // beige
  "#800000",  // maroon
  "#aaffc3",  // mint
  "#808000",  // olive
  "#ffd8b1",  // coral
  "#000080",  // navy
  "#808080",  // grey
  "#FFFFFF",  // white
  "#000000"   // black
];

let KEYS = {
  SPACE : 32,
  LEFT_ARROW : 37,
  RIGHT_ARROW : 39,
  ESCAPE : 27,
  D: 68,
  H: 72,
  N: 78,
  S: 83
};

// Convenience class for creating circular markers of a specific color.
let ColorableDivIcon = L.DivIcon.extend({

  setBackground : function(background){
    this.background = background;
  },

  setColor : function(color){
    this.color = color;
  },

  createIcon : function(oldIcon){

    let div = L.DivIcon.prototype.createIcon.call(this, oldIcon);

    div.style.backgroundColor = this.options.style.fillColor;
    let diameter = '' + (this.options.style.radius * 2) + 'px';
    div.style.height = diameter;
    div.style.width = diameter;

    if (this.background != 'undefined' && this.background != null){
      div.style.background = this.background;
    }

    return div;

  }

});

class LeafletAnnotation {


  constructor(leafletClass) {
    this.leafletClass = leafletClass;
    this.imageOverlay = null;

    this.categoryMap = null;

    // We'll use this list to mirror the json annotations
    this.annotation_layers = [];

    this.showingSkeleton = false;
  }

  create() {
    this.leafletMap = L.map(this.leafletClass, {
          keyboard: false,
          center : [0, 0],
          zoom : 0,
          crs: L.CRS.Simple,
          zoomControl : true,
          maxBoundsViscosity : 0.5,
          drawControlTooltips : false
      }); 
      const leafletMap = this.leafletMap;

      // Add the feature group that will hold the annotations
      // All layers added to this feature group will be editable
      this.annotationFeatures = new L.FeatureGroup().addTo(leafletMap);
  }

  setImage(image) {

    if (this.imageOverlay != null) {
      this.leafletMap.removeLayer(this.imageOverlay);
    }

      const leafletMap = this.leafletMap;

    // Determine the resolution that the image will be rendered at
    let pixel_bounds = leafletMap.getPixelBounds();
    let maxWidth = pixel_bounds.max.x - pixel_bounds.min.x;
    let maxHeight = pixel_bounds.max.y - pixel_bounds.min.y;

    let imageWidth = image.width;
    let imageHeight = image.height;

    let ratio = [maxWidth / imageWidth, maxHeight / imageHeight ];
    ratio = Math.min(ratio[0], ratio[1]);

    let height = ratio * imageHeight;
    let width = ratio * imageWidth;

    // Save off the resolution of the image, we'll need this
    // for scaling the normalized annotations
    this.imageWidth = width;
    this.imageHeight = height;
    this.ratio = ratio;

    // Restrict the map to the image bounds
    let southWest = leafletMap.unproject([0, height], leafletMap.getMinZoom());
    let northEast = leafletMap.unproject([width, 0], leafletMap.getMinZoom());
    let bounds = new L.LatLngBounds(southWest, northEast);

    // GVH: The order of these calls matter!
    // leafletMap.fitBounds(bounds, {
    //   animate: false,
    //   duration: 0
    // });
    leafletMap.setMaxBounds(bounds);


    this.imageOverlay = L.imageOverlay(image.src, bounds).addTo(leafletMap);  

    // Bind methods to 'this'
    this.setKeypointXY = this.setKeypointXY.bind(this);
    this.getAnnotations = this.getAnnotations.bind(this);
  }

  createBBoxPathStyle(color) {
      return {
        'stroke' : true,
        'color' : color,
        'weight' : 4,
        'opacity' : 1,
        'fill' : false,
        'fillColor' : color,
        'fillOpacity' : 0.2
      }
    }

    createKeypointPathStyle(color) {
      return {
        'color' : color,
        'stroke' : false,
        'weight' : 5,
        'opacity' : 0.5,
        'fill' : true,
        'fillColor' : color,
        'fillOpacity' : 1,
        'radius' : 5
      }
    }

    createKeypointSolidBackgroundStyle(color){
      return "" + color;
    }

    createKeypointStripedBackgroundStyle(color){
      return "repeating-linear-gradient(   45deg,   " + color + ",   " + color + " 2px,   black 2px,   black 4px )";
    }

    /**
     * Add an annotation layer to the leaflet map.
     * @param {*} layer
     */
    addLayer(layer){
      if(layer != 'undefined' && layer != null){
        if(!this.annotationFeatures.hasLayer(layer)){
          this.annotationFeatures.addLayer(layer);

          // Remove the edit styling for the markers.
          $( ".leaflet-marker-icon" ).removeClass( "leaflet-edit-marker-selected" );
        }
      }
    }

    /**
     * Remove an annotation layer from the leaflet map.
     * @param {*} layer
     */
    removeLayer(layer){

      if(layer != 'undefined' && layer != null){
        if(this.annotationFeatures.hasLayer(layer)){
          this.annotationFeatures.removeLayer(layer);
        }
      }

    }

  clearSkeleton() {
    for (var a_id = 0; a_id < this.annotation_layers.length; a_id++) {
      let annotation_layer = this.annotation_layers[a_id];
      if (annotation_layer.skeleton != 'undefined' && annotation_layer.skeleton != null){
        for (var i=0; i < annotation_layer.skeleton.length; i++){
          let layer = annotation_layer.skeleton[i];
          this.removeLayer(layer);
        }
      }
      annotation_layer.skeleton = [];
    }
  }

  drawSkeletonForLayer(layer) {

    let SKELETON = [
      //head
      [0, 1, 'red'], // nose - left eye
      [1, 3, 'red'], // left eye - left ear 
      [0, 2, 'lime'], // nose - right eye
      [2, 4, 'lime'], // righ eye - right ear

      // left side
      [5, 7, 'red'], // left shoulder - left elbow
      [7, 9, 'red'], // left elbow - left wrist 

      [11, 13, 'magenta'], // left hip - left knee
      [13, 15, 'magenta'], // left hip - left ankle

      // right side
      [6, 8, 'lime'], // right shoulder - right elbow
      [8, 10, 'lime'], // right elbow - right wrist 

      [12, 14, 'cyan'], // right hip - right knee
      [14, 16, 'cyan'], // right hip - right ankle

      // middle

      [5, 6, 'blue'], // left shoulder - right shoulder
      [5, 11, 'blue'], // left shoulder - left hip
      [6, 12, 'blue'], // right shoulder - right hip
      [11, 12, 'blue'], // left hip - right hip
    ]

    if (layer['skeleton'] == 'undefined' || layer['skeleton'] == null) {
      layer['skeleton'] = [];
    }

    for (var i = 0; i < SKELETON.length; i++) {
      let line = SKELETON[i];
      let kp1 = line[0];
      let kp2 = line[1];
      let color = line[2];

      if (layer['keypoints'][kp1] == null || layer['keypoints'][kp2] == null) {
        continue;
      }

      var pointList = [layer['keypoints'][kp1].getLatLng(), layer['keypoints'][kp2].getLatLng()]
      var firstpolyline = new L.Polyline(pointList, {
        color: color,
        weight: 2,
        opacity: 0.5,
        smoothFactor: 1
      });
      this.addLayer(firstpolyline);

      layer['skeleton'].push(firstpolyline);
    }
    
  }

  drawSkeleton() {

    this.clearSkeleton();

    for (var a_id = 0; a_id < this.annotation_layers.length; a_id++) {
      let annotation_layer = this.annotation_layers[a_id];
      this.drawSkeletonForLayer(annotation_layer);
    }
  }

  setShowingSkeleton(showSkeleton) {
    this.showingSkeleton = showSkeleton;
    if (showSkeleton) {
      this.drawSkeleton();
    } else {
      this.clearSkeleton();
    }
  }

  /**
   * Add an annotation to the image. This will render the bbox and keypoint annotations.
   * @param {*} annotation
   * @param {*} annotationIndex
   */
  addAnnotation(annotation, annotationIndex, keypointStyleIdx=null) {

    // console.log("Adding annotation ");
    // console.log(annotation);

    // let imageWidth = this.imageWidth;
    // let imageHeight = this.imageHeight;
    let ratio = this.ratio;

    // Get the category for this instance, we need to access the keypoint information
    var category = null;
    if(annotation['category_id'] != 'undefined'){
      category = this.categoryMap[annotation['category_id']];
    }

      // Store the layers for this annotation
    var layers = {
      'bbox' : null,
      'keypoints' : null,
      'skeleton' : null
    };

    // Add the bounding box
    if(annotation.bbox != 'undefined' && annotation.bbox != null){

      let color = COLORS[annotationIndex % COLORS.length];
      let pathStyle = this.createBBoxPathStyle(color)

      // console.log('iamge width: ' + imageWidth);
      var [x, y, w, h] = annotation.bbox;
      let x1 = x * ratio; // imageWidth;
      let y1 = y * ratio; // imageHeight;
      let x2 = (x + w) * ratio; // imageWidth;
      let y2 = (y + h) * ratio; // imageHeight;
      // let bounds = L.latLngBounds(this.leafletMap.unproject([x1, y1], 0), this.leafletMap.unproject([x2, y2], 0));
      let bounds = L.latLngBounds(this.leafletMap.unproject([x1, y1], 0), this.leafletMap.unproject([x2, y2], 0));
      let layer = L.rectangle(bounds, pathStyle);

      this.addLayer(layer);
      layers.bbox = layer;

    }

    // Add the keypoints
    if(annotation.keypoints != 'undefined' && annotation.keypoints != null){
      layers['keypoints'] = [];
      layers['skeleton'] = [];

      // We should just assume that these exist...
      let keypoint_names = null;
      let keypoint_styles = null;
      if(category != null){
        keypoint_names = category['keypoints'];
        keypoint_styles = category['keypoints_style'];
      }

      // Render a marker for each keypoint
      for( var i = 0; i < annotation.keypoints.length / 3; i++) {

        // Don't display "impossible" annotations
        if (annotation.difficulty != null && annotation.difficulty[i] == 3) {
          layers['keypoints'].push(null);
          continue;
        }

        let keypoint_name = keypoint_names[i];
        let keypoint_idx = keypointStyleIdx;

        if (keypoint_idx == null || keypoint_idx == -1) {
          keypoint_idx = i;
        } else {
          keypoint_idx = keypoint_idx[i];
        }

        let keypoint_color = keypoint_styles[keypoint_idx];

        let index = i * 3;
        var x = annotation.keypoints[index];
        var y = annotation.keypoints[index + 1];
        var v = annotation.keypoints[index + 2];

        var marker = null;
        if (v > 0){

          x = x*ratio;// * imageWidth;
          y = y*ratio;// * imageHeight;
          let latlng = this.leafletMap.unproject([x,y], 0);

          var markerDiv = new ColorableDivIcon({
            iconAnchor : [4, 4],
            popupAnchor : [0, -4],
            className : 'circle-marker',
            style : this.createKeypointPathStyle(keypoint_color)
          });
          if (v == 1){
            markerDiv.setBackground(this.createKeypointStripedBackgroundStyle(keypoint_color));
          }

          // Create marker
          marker = L.marker(latlng, {icon : markerDiv, draggable: true});

          // Map will "follow" where you drag the marker
          let map = this.leafletMap;
          let self = this;
          marker.on('dragend', function(event){
            var marker = event.target;
            var position = marker.getLatLng();

            // Make sure marker remains inside image bounds
            let pt = self.extractKeypoint(marker);
            self.setKeypointXY(annotationIndex, index/3, pt[0], pt[1]);

            let new_x = pt[0] * ratio;
            let new_y = pt[1] * ratio;
            let new_position = map.unproject([new_x, new_y], 0);

            console.log(new_x);
            console.log(new_y);
            console.log(pt[0]);

            // set new marker position and move camera there
            marker.setLatLng(new L.LatLng(new_position.lat, new_position.lng),{draggable:'true'});
            // pan to new position
            // map.panTo(new L.LatLng(new_position.lat, new_position.lng))
          });
          marker.bindTooltip(keypoint_name, {
            className : '',
            direction : 'auto'
          });

          marker.on('click', function(event) {
            self.handleClick(index/3)
          })

          this.addLayer(marker);

        }

        layers['keypoints'].push(marker);

      }

      if (this.showingSkeleton) {
        this.drawSkeletonForLayer(layers);
      }

    }

    return layers;

  }

  setAnnotations(annotations, categories, keypointStyleIdx=null) {

    // this.data = data;

    this.annotations = annotations;

    this.clearAnnotations();

    // const annotations = data.annotations;
    // const categories = data.categories;

    if (this.categoryMap == null) {
      this.categoryMap = {};
          for(var i = 0; i < categories.length; i++){
            var category = categories[i]
            this.categoryMap[category['id']] = category;
          }
      }

    console.log("Setting annotations...");
    console.log(annotations);

    // Add the annotations
    for(var i=0; i < annotations.length; i++){
      let style = null;
      if (keypointStyleIdx != null) {
        style = keypointStyleIdx[i];
      }
      this.annotation_layers.push(this.addAnnotation(annotations[i], i, style));
    }


  }

  clearAnnotations() {

    // this.leafletMap.eachLayer((layer) => {
      // layer.remove();
    // });

    for (var a_id = 0; a_id < this.annotation_layers.length; a_id++) {
      let annotation_layer = this.annotation_layers[a_id];

      // Remove the bbox.
      if(annotation_layer.bbox != 'undefined' && annotation_layer.bbox != null){
        let layer = annotation_layer.bbox;
        this.removeLayer(layer);
      }

      // Remove the keypoints.
      if(annotation_layer.keypoints != 'undefined' && annotation_layer.keypoints != null){
        for( var i=0; i < annotation_layer.keypoints.length; i++){
            let layer = annotation_layer.keypoints[i];
            this.removeLayer(layer);
        }
      }

      this.clearSkeleton();      
    }

    this.annotation_layers = [];
  }

  /**
     * Focus on a particular instance by zooming in on it.
     * @param {*} annotationIndex
     */
    handleAnnotationFocus(annotationIndex){

      console.log("Focusing on annotation index " + annotationIndex);


      let annotation = this.annotations[annotationIndex];
      let annotation_layer = this.annotation_layers[annotationIndex];

      // lets show the annotations if they are not shown
      // this.showAnnotation(annotation, annotation_layer);

      if(annotation_layer['bbox'] != 'undefined' && annotation_layer['bbox'] != null){
        let layer = annotation_layer['bbox'];
        let bounds = layer.getBounds();
        console.log(bounds);
        console.log(layer);
        this.leafletMap.fitBounds(bounds, {animate:true});
      } else {
        console.log("Err");
      }

    }

    centerLeafletMapOnMarker(markerIdx) {
      // If we only show 1 isolated point, focus on that one.
      if (this.annotation_layers[0]['keypoints'].length == 1) {
        markerIdx = 0;
      }

        if (markerIdx < this.annotation_layers[0]['keypoints'].length) {
      let marker = this.annotation_layers[0]['keypoints'][markerIdx];
      console.log(marker);
      var latLngs = [ marker.getLatLng() ];
      console.log(latLngs);
      var markerBounds = L.latLngBounds(latLngs);
      console.log(markerBounds);
        // this.leafletMap.fitBounds(markerBounds);
        console.log(latLngs[0].lat);
        this.leafletMap.setView([latLngs[0].lat, latLngs[0].lng], 5);
    } else {
      console.log(this.annotation_layers[0]['keypoints'].length);
      console.log(this.annotation_layers[0]['keypoints']);
    }
  }

  /**
     * Translate the point (if needed) so that it lies within the image bounds
     * @param  {[type]} x [description]
     * @param  {[type]} y [description]
     * @return {[type]}   [description]
     */
    _restrictPointToImageBounds(x, y){

      if(x > this.imageWidth){
        x = this.imageWidth;
      }
      else if(x < 0){
        x = 0;
      }
      if (y > this.imageHeight){
        y = this.imageHeight;
      }
      else if(y < 0){
        y = 0;
      }

      return [x, y];

    }

    /**
     * Extract a keypoint annotation from a keypoint layer.
     * @param {*} layers
     */
    extractKeypoint(layer) {
      let point = layer.getLatLng();
      point = this.leafletMap.project(point, 0);
      let x1 = point.x;
      let y1 = point.y;
      [x1, y1] = this._restrictPointToImageBounds(x1, y1);
      let x = x1 / this.ratio;// / this.imageWidth;
      let y = y1 / this.ratio;// / this.imageHeight;

      x = Math.round(x);
      y = Math.round(y);
      console.log('x' + x + '  y:'+y);

      return [x,y];
    }

    setKeypointModifiedCallback(callback) {
      this.keypointModCallback = callback;
    }


    setKeypointXY(annotationIdx, keypointIdx, x, y) {

      console.log('idx ' + keypointIdx + ' is now x:' + x + ' y:' + y);
      this.annotations[annotationIdx].keypoints[keypointIdx*3] = x
      this.annotations[annotationIdx].keypoints[keypointIdx*3+1] = y;

      if (this.keypointModCallback != null) {
        this.keypointModCallback(keypointIdx);
      }

      if (this.showingSkeleton) {
        this.drawSkeleton();
      }
    }

    setKeypointClickCallback(callback) {
      this.keypointClickCallback = callback;
    }

    handleClick(keypointIdx) {
      console.log('keypoint ' + keypointIdx + ' clicked.');
      if (this.keypointClickCallback != null) {
        this.keypointClickCallback(keypointIdx);
      }
    }

  /**
     * Get list of all keypoints
     */
    getAnnotations() {
      return this.annotations;
    }




}