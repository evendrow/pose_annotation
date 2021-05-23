
class JRDBAnnotator {

  constructor(scene, leafletClassStiched, leafletClassSingle) {

    this.VERSION = "0.2";

    this.scene = scene

    this.LOAD_ALL_DATA = true;
    this.SHOW_UNSTICHED_VIEW = false;
    
    this.frameIdx = 0;
    this.personIdx = 0;
    this.trackList = [];
    this.trackIdx = 0;
    this.keypointIdx = -1;
    this.selectedKeypointIdx = 0;

    this.show_skeleton = true;
    this.lighten = false;

    this.copiedPoints = null;
    this.copiedDifficulty = null;
    this.copiedVisibility = null;

    this.image = new Image;
    this.image.src = "/images/image_stiched/"+scene+"/000003.jpg";

    this.interpolating = false;
    this.interpIdx = -1;
    this.interp_gt_list = [];

    // Bind methods
    this.leafletModifedCallback = this.leafletModifedCallback.bind(this);
    this.leafletClickCallback = this.leafletClickCallback.bind(this);
    this.getNewScenePeople = this.getNewScenePeople.bind(this);
    this.getNewSceneData = this.getNewSceneData.bind(this);
    this.setSceneData = this.setSceneData.bind(this);
    this.fillHTMLKeypointsList = this.fillHTMLKeypointsList.bind(this);
    this.setSelectedKeypointIdx = this.setSelectedKeypointIdx.bind(this);
    this.refreshSelection = this.refreshSelection.bind(this);
    
    this.setDifficulty = this.setDifficulty.bind(this);
    this.getDifficulty = this.getDifficulty.bind(this);
    this.updateDifficulty = this.updateDifficulty.bind(this);
    this.showDifficulty = this.showDifficulty.bind(this);

    this.setVisibility = this.setVisibility.bind(this);
    this.getVisibility = this.getVisibility.bind(this);
    this.updateVisibility = this.updateVisibility.bind(this);
    this.showVisibility = this.showVisibility.bind(this);

    // Initialize annotator
    this.leaflet = new LeafletAnnotation(leafletClassStiched);
    this.leaflet.create();

    this.leaflet.setShowingSkeleton(this.show_skeleton);
    this.leaflet.setKeypointModifiedCallback(this.leafletModifedCallback);
    this.leaflet.setKeypointClickCallback(this.leafletClickCallback);

    // Initialize annotator
    this.leaflet_single = new LeafletAnnotation(leafletClassSingle);
    this.leaflet_single.create();

    if (!this.SHOW_UNSTICHED_VIEW) {
      $('#'+leafletClassSingle).css('display', 'none');
      $('#'+leafletClassStiched).css('height', '100%');
    }

    // Initialize stich
    this.stich = new JRDB_Stich();


    const self = this;
    this.refreshImage(this.image.src, function() {
      self.message('Loading stich information...');
      self.stich.load(self.SHOW_UNSTICHED_VIEW, function() {
        self.message('Loading people...');
        self.getNewScenePeople(function() {
          console.log("Got list of people.");
          self.message('Loading annotations...');
          self.getNewSceneData(self.setSceneData, function() {
            console.log("Error getting scene data");
          });
        }, function() {
          console.log("Error getting scene people");
          alert("ERROR getting people. Check console for details.");
        })
      }, function() {
        console.log("Error getting stich");
        alert("ERROR getting stich conversion. Check console for details.")
      });
    });

    // Sync maps
    this.leaflet.leafletMap.on('zoom', function() { 
      console.log('zoom!');
      var bounds = self.leaflet.leafletMap.getBounds();
      self.leaflet_single.leafletMap.fitBounds(bounds);
    });

    this.leaflet_single.leafletMap.on('zoom', function() { 
      console.log('zoom!');
      var bounds = self.leaflet_single.leafletMap.getBounds();
      self.leaflet.leafletMap.fitBounds(bounds);
    });

    // var image = new Image();
    // image.src = "https://i.imgur.com/zkqRw1q.jpeg"
    // image.src = "http://localhost:8008/images/bytes-cafe-2019-02-07_0/000003.jpg";
    // this.leaflet.setImage(image);


    $("#version").html("v"+this.VERSION);
  }

  message(msg) {
    $("#message").html(msg);

    // stop currently running animations, if exist
    $("#message").stop();

    // Make message text black, then fade to light gray
    $("#message").css("opacity", 1);
    setTimeout(function() {
      $("#message").animate({
        opacity: 0.3
      }, 800, "swing");
    }, 200)
    
  }

  get_current_annotation() {
    let frame = this.data.annotations_list[this.frameIdx];
    let person = frame.find(a => a['track_id'] == this.trackList[this.trackIdx]);
    return person;  
  }

  // Callback for when leaflet 
  leafletModifedCallback(modifiedIdx) {
    let annots = this.leaflet.getAnnotations();
    let new_keypoints = annots[0].keypoints;

    /*
    let frame = this.data_single.annotations_list[this.frameIdx];
    let person = frame.find(a => a['track_id'] == this.trackList[this.trackIdx]);
    person.keypoints = this.convert_from_stiched(new_keypoints);
    // this.data_single

    this.leaflet_single.setAnnotations([person],
                                 this.data.categories, this.keypointIdx);
    */
    // console.log("Old keypoints: " + this.data.annotations_list[this.frameIdx][this.personIdx].keypoints);
    // console.log("new keypoints: " + new_keypoints);

    if (this.interpolating) {
      // console.log("modified idx " + modifiedIdx);
      // console.log('modified pt: ' + new_keypoints)
      let xy = [new_keypoints[modifiedIdx*3], new_keypoints[modifiedIdx*3 + 1]];
      this.addInterpolationPoint(modifiedIdx, xy);
    }
  }

  leafletClickCallback(clickIdx) {
    let annots = this.leaflet.getAnnotations();
    let new_keypoints = annots[0].keypoints;
    if (this.interpolating) {
      let xy = [new_keypoints[clickIdx*3], new_keypoints[clickIdx*3 + 1]];
      this.addInterpolationPoint(clickIdx, xy);
    } else {
      $("#check_keypoints_id_"+clickIdx)[0].checked = true;
      this.refreshSelection();
    }
  }

  beginInterpolation() {
    this.message("Began interpolation...");
    this.interpolating = true;
    this.interpIdx = -1;
    this.interp_gt_list = [];
  }

  endInterpolation() {
    this.interpolating = false;
  }

  addInterpolationPoint(kp_idx, pt) {
    console.log("Adding point " + pt);
    // First, see if we have this index already
    let frame_idx = this.interp_gt_list.findIndex(el => el["frame"] == this.frameIdx);
    console.log("found frame match at idx " + frame_idx);
    if (frame_idx == -1) {
      // no mathcing frame found, create new one with this point
      this.interp_gt_list.push({"frame": this.frameIdx, "kps": []});

      let frame_idx = this.interp_gt_list.length-1;
      this.interp_gt_list[frame_idx]["kps"].push([kp_idx, pt[0], pt[1]]);
      this.message("Added new interpolation frame and point.")

    } else {
      // matching frame found, try to find matching point
      let point_idx = this.interp_gt_list[frame_idx]["kps"].findIndex(el => el[0] == kp_idx);
      console.log("found point match at idx " + point_idx);
      if (point_idx != -1) {
        // matching point found, just need to change its x/y
        this.interp_gt_list[frame_idx]["kps"][point_idx][1] = pt[0];
        this.interp_gt_list[frame_idx]["kps"][point_idx][2] = pt[1];
      } else {

        // no matching point found, need to add new point
        this.interp_gt_list[frame_idx]["kps"].push([kp_idx, pt[0], pt[1]]);
      }
      this.message("Added new interpolation point.")
    }
    console.log(this.interp_gt_list);

    this.fillInterpolationList();
  }

  removeInterpolationPoint(frame, idx) {
    console.log("Looking for frame" + frame);
    let frame_idx = this.interp_gt_list.findIndex(el => el["frame"] == frame);
    var interp_frame = this.interp_gt_list[frame_idx]["kps"];
    if (frame_idx != -1) {
      let point_idx = interp_frame.findIndex(el => el[0] == idx);
      interp_frame.splice(point_idx, 1);
      
      // Remove frame from interpolation list if it's empty
      if (interp_frame.length == 0) {
        console.log("interp frame empty!");
        this.interp_gt_list.splice(frame_idx, 1);
      }

      this.fillInterpolationList();
      this.message("Removed interpolation point.")
    } else {
      this.message("Could not find interpolation point.");
    }
    
  }

  fillInterpolationList() {

    // First, properly sort the list
    this.interp_gt_list.sort((a, b) => a["frame"] - b["frame"]);
    for (var i = 0; i < this.interp_gt_list.length; i++) {
      this.interp_gt_list[i]["kps"].sort((a, b) => a[0] - b[0]);
    }

    console.log("filling interp list.");
    console.log(this.interp_gt_list);

    var self = this;
    $("#keypoint_list").html("");

    for (var i = 0; i < this.interp_gt_list.length; i++) {
      let frame = this.interp_gt_list[i]["frame"];

      for (var j = 0; j < this.interp_gt_list[i]["kps"].length; j++) {
        let kp_idx = this.interp_gt_list[i]["kps"][j][0];
        let key = this.data.categories[0].keypoints[kp_idx];
        let color = this.data.categories[0].keypoints_style[kp_idx];

        let id = "interp_gt_id_"+i+"_"+j;
        $("#keypoint_list").append(`
          <div class="row keypoint">
            <div class="keypoint_color_container">
              <div class="keypoint_color" style="background-color:`+color+`;"></div>
            </div>
            <div class="keypoint_desc">
              <p>Frame `+frame+`, `+key+`</p>
            </div>
            <div class="button">
              <div class="btn-group btn-group-xs" role="group">
                <button class="btn btn-outline-secondary" id="interp_view_`+id+`">
                  <i class="fas fa-eye"></i>
                  View
                </button>
                <button class="btn btn-outline-secondary" id="interp_rm_`+id+`">
                  <i class="far fa-trash-alt"></i>
                  Remove
                </button>
              </div>
            </div>
          </div>
        `);

        $("#interp_view_"+id).click(function() {
          let idx = parseInt(this.id.split("_")[2], this.id.split("_")[3]);
          self.frameIdx = frame;
          self.refreshAll();
        });

        $("#interp_rm_"+id).click(function() {
          let idx = parseInt(this.id.split("_")[2], this.id.split("_")[3]);
          self.removeInterpolationPoint(frame, idx);
        });
      }
    }
  }

  performInterpolation() {

    console.log("Performing interpolation");
    console.log(this.interp_gt_list.length);

    if (this.interp_gt_list.length != 2) {
      this.message("Error: Need exactly 2 frames of points to interpolate!");
      return false;
    }

    // Sanity check: All frames must have same keypoints
    let master_kps = this.interp_gt_list[0]["kps"].map(k => k[0]).sort((a, b) => a-b);
    console.log("Master kps: " + master_kps)
    for (var i = 1; i < this.interp_gt_list.length; i++) {
      let kps = this.interp_gt_list[i]["kps"].map(k => k[0]).sort((a, b) => a-b);

      // Make sure array sizes match
      if (master_kps.length != kps.length) {
        this.message("Error: Each frame must have same keypoints for interpolation!");
        return false;
      }

      // Make sure arrays are identical
      for (var k = 0; k < master_kps.length; k++) {
        if (master_kps[k] != kps[k]) {
          this.message("Error: Each frame must have same keypoints for interpolation!");
          return false;
        }
      }

    }

    if (this.interp_gt_list.length >= 2) {
      // Sort frame and keypoints
      this.interp_gt_list.sort((a, b) => a["frame"] - b["frame"]);
      for (var i = 0; i < this.interp_gt_list.length; i++) {
        this.interp_gt_list[i]["kps"].sort((a, b) => a[0] - b[0]);
      }

      for (var i = 0; i < master_kps.length; i++) {
        let keyIdx = master_kps[i];

        let startIdx = this.interp_gt_list[0]["frame"];
        let endIdx = this.interp_gt_list[this.interp_gt_list.length-1]["frame"];

        let first_track_id = this.trackList[this.trackIdx];
        let first_match_idx = this.data.annotations_list[startIdx].findIndex(a => a['track_id'] == first_track_id);
        let firstFrame = this.data.annotations_list[startIdx][first_match_idx];

        // console.log("start idx: " + startIdx);
        // console.log("end idx: " + endIdx);

        // "before" points from interpolation list
        var points = this.interp_gt_list.map(function(a) {
          return [a["kps"][i][1], a["kps"][i][2]];
        });

        console.log("points: " + points);

        var path = Smooth(points, {
          method: Smooth.METHOD_CUBIC, 
          // clip: Smooth.CLIP_PERIODIC, 
          cubicTension: Smooth.CUBIC_TENSION_CATMULL_ROM,
          scaleTo: [startIdx, endIdx]
        });

        for (var frame = startIdx; frame <= endIdx; frame++) {

          // see if the person exists at this frame
          let track_id = this.trackList[this.trackIdx];
          let match_idx = this.data.annotations_list[frame].findIndex(a => a['track_id'] == track_id);
          // console.log('match idx: ' + match_idx);

          if (match_idx >= 0) {

            let pt = path(frame);
            // console.log('point ' + frame + ': ' + pt);
            this.data.annotations_list[frame][match_idx].keypoints[keyIdx*3] = pt[0];
            this.data.annotations_list[frame][match_idx].keypoints[keyIdx*3+1] = pt[1];

            this.data.annotations_list[frame][match_idx].difficulty[keyIdx] = firstFrame.difficulty[keyIdx];
            this.data.annotations_list[frame][match_idx].visibility[keyIdx] = firstFrame.visibility[keyIdx];
          }
        }
      }
    }

    this.message("Did interpolation.");
    this.refreshAll();

    return true;
  }

  performCopy() {
    let frame = this.data.annotations_list[this.frameIdx];
    let person = frame.find(a => a['track_id'] == this.trackList[this.trackIdx]);
    if (person != null) {
      this.copiedPoints = person.keypoints.map((x) => x); // clone
      this.copiedVisibility = person.visibility.map((x) => x); // clone
      this.copiedDifficulty = person.difficulty.map((x) => x); // clone
    }

    this.message("Copied all keypoints.");
  }

  performPaste() {
    if (this.copiedPoints == null) {
      alert('Nothing copied.');
    } else {
      let frame = this.data.annotations_list[this.frameIdx];
      let person = frame.find(a => a['track_id'] == this.trackList[this.trackIdx]);
      if (person != null) {
        // set contents to a clone of the copies points
        person.keypoints = this.copiedPoints.map((x) => x);
        person.difficulty = this.copiedDifficulty.map((x) => x);
        person.visibility = this.copiedVisibility.map((x) => x);
        this.refreshAll(); 
      }
    }

    this.message("Pasted all keypoints.");
  }

  performCopyDiffVis() {
    var difficulty = this.getDifficulty();
    let frame = this.data.annotations_list[this.frameIdx];
    let person = frame.find(a => a['track_id'] == this.trackList[this.trackIdx]);
    if (person != null) {
      this.copiedVisibility = person.visibility.map((x) => x); // clone
      this.copiedDifficulty = person.difficulty.map((x) => x); // clone
    }

    this.message("Copied difficulty and visibility for all points.");
    
  }

  performPasteDiffVis() {
    if (this.copiedDifficulty == null) {
      alert('Nothing copied.');
    } else {
      let frame = this.data.annotations_list[this.frameIdx];
      let person = frame.find(a => a['track_id'] == this.trackList[this.trackIdx]);
      if (person != null) {
        // set contents to a clone of the copies points
        person.difficulty = this.copiedDifficulty.map((x) => x);
        person.visibility = this.copiedVisibility.map((x) => x);
        this.refreshAll(); 
      }
    }

    this.message("Pasted difficulty and visibility for all points.");
  }

  setKeypointIdx(idx) {

    console.log("Setting new keypoint with id "+idx);
    this.keypointIdx = idx;
    let self = this;
    this.getNewSceneData(function(data) {
      self.setSceneData(data);
    }, function() {
      console.log("Error getting scene data");
    });
  }

  setSelectedKeypointIdx(idx) {
    console.log("Selecting new keypoint with id "+idx);
    this.selectedKeypointIdx = idx;
    let name = this.data.categories[0].keypoints[idx];
    let color = this.data.categories[0].keypoints_style[idx];
    $('#selected_keypoint_color').css("background-color", color);
    $('#selected_keypoint_name').html(name);

    let frame = this.data.annotations_list[this.frameIdx];
    let person = frame.find(a => a['track_id'] == this.trackList[this.trackIdx]);
    if (person == null) {
      $('#keypoint_info_warning').show();
      $('#keypoint_info_contents').hide();
    } else {
      $('#keypoint_info_warning').hide();
      $('#keypoint_info_contents').show();
      this.showDifficulty(person.difficulty[idx]);
      this.showVisibility(person.visibility[idx]);  
    }
    
    // uncheck all, except for the selected keypoint
    let boxes = $('.keypoint_checkbox').children('input');
    for (var i = 0; i < boxes.length; i++) {
      boxes[i].checked = (i == idx);
    }

    this.message("Selected keypoint '"+name+"'.");
  }

  applyKalmanFilter(idx) {
    console.log("applying kalman filter to id "+idx);

    let track_id = this.trackList[this.trackIdx];
    // let personIdx = this.data.annotations_list[this.frameIdx].find(a => a['track_id'] == track_id);

    var kalmanFilterX = new KalmanFilter({R: 0.001, Q: 0.002});
    var kalmanFilterY = new KalmanFilter({R: 0.001, Q: 0.002});

    var old_points = [];
    var new_points = [];

    let num_frames = this.data.annotations_list.length;
    for (var i = 0; i < num_frames; i++) {

      let person = this.data.annotations_list[i].find(a => a['track_id'] == track_id);

      let kp_x = person.keypoints[idx*3];
      let kp_y = person.keypoints[idx*3 + 1];

      let new_x = kalmanFilterX.filter(kp_x);
      let new_y = kalmanFilterY.filter(kp_y);

      old_points.push(kp_x);
      new_points.push(new_x);

      person.keypoints[idx*3] = new_x;
      person.keypoints[idx*3 + 1] = new_y;
    }

    console.log('Done filtering ' + num_frames + ' frames');
    console.log(old_points);
    console.log(new_points);
    

    // var dataConstantKalman = noisyDataConstant.map(function(v) {
    //   return kalmanFilter.filter(v);
    // });
  }

  isolateKeypiont(idx) {

  }

  getNewScenePeople(onSuccess, onFail) {
    let url =  '/jrdb/people/' + this.scene;
    var self = this;
    $.ajax({
      url: url,
      method: 'GET'
    }).done(function(data){
      console.log(data);
      self.trackList = data.people;
      onSuccess();
    }).fail(function(jqXHR, textStatus, errorThrown ){
      console.log(textStatus);
      onFail();
    });
  }


  performSave(onSuccess, onFail){
    this.message("Saving...");
    console.log("saving annotations...");
    var self = this;
    $.ajax({
      url : "/annotations/savemany/"+this.scene,
      method : 'POST',
      data : JSON.stringify({'annotations_list' : this.data.annotations_list}),
      contentType: 'application/json'
    }).done(function(){
      console.log("saved annotations");
      self.message("Saved!");
      onSuccess();
    }).fail(function(){
      onFail();
    });
  }

  getNewSceneData(onSuccess, onFail) {
    let url =  '/jrdb/scene/'+this.scene+'?keypoint=' + this.keypointIdx;
    if (!this.LOAD_ALL_DATA) {
      url += '&person=' + this.trackList[this.trackIdx];
    }

    $.ajax({
      url: url,
      method: 'GET'
    }).done(function(data){
      console.log(data);
      onSuccess(data);
    }).fail(function(jqXHR, textStatus, errorThrown ){
      console.log(textStatus);
      onFail();
    });
  }

  setSceneData(data) {
    this.message('Got new annotations.');
    this.data = data;
    this.data_single = data;
    // this.convert_all_from_stiched(this.data_single.annotations_list);
    this.fillHTMLKeypointsList();
    this.refreshAll();
    console.log(data.categories);
  }

  convert_all_from_stiched(annots_list) {
    for (var i = 0; i < annots_list.length; i++) {
      var annots = annots_list[i];
      for (var j = 0; j < annots.length; j++) {
        var ann = annots[j];
        ann.keypoints = this.convert_from_stiched(ann.keypoints);
      }
    }
  }

  convert_from_stiched(kps) {
    var new_kps = Array.from(kps);
    for (var k = 0; k < 17; k++) {
      new_kps[k*3] += 20;
    }
    return new_kps;
  }

  // <================ Selection

  // Sets all keypoints to be selected
  selectAll() {
    if (this.interpolating) {
      // add every keypoint to the interpolation list
      for (var i = 0; i < this.data.categories[0].keypoints.length; i++) {
        console.log(i);
        this.leafletModifedCallback(i);
      }

      this.message("Added all points in current frame to interpolation.")

    } else {
      let boxes = $('.keypoint_checkbox').children('input');
      for (var i = 0; i < boxes.length; i++) {
        boxes[i].checked = true;
      }

      this.refreshSelection();
      this.message("Selected all " + (this.getSelectedIndexes().length) + " keypoints.");
    }
  }

  selectNone() {
    if (this.interpolating) {
      // Remove every keypoint from the interpolation list
      for (var i = 0; i < this.data.categories[0].keypoints.length; i++) {
        this.removeInterpolationPoint(this.frameIdx, i);
      }
      this.message("Removed all points in current frame from interpolation.")

    }  else {
      let boxes = $('.keypoint_checkbox').children('input');
      for (var i = 0; i < boxes.length; i++) {
        boxes[i].checked = false;
      }

      this.refreshSelection();
      this.message("Selecting no keypoints.");
    }
    
  }

  getSelectedIndexes() {
    var boxes = $('.keypoint_checkbox').children('input');
    boxes = boxes.filter(function(i, a) { return a.checked; })
    let indexes = boxes.map(function(i, a) { 
      return Number(a.id.split("_").pop()); 
    });
    return indexes;
  }

  refreshSelection() {
    let selectedIndexes = this.getSelectedIndexes();

    if (selectedIndexes.length == 0) {
      $('#selected_keypoint_color').css("background-color", "#999");
      $('#selected_keypoint_name').html("None Selected.");  
    }
    if (selectedIndexes.length == 1) {
      this.setSelectedKeypointIdx(selectedIndexes[0]);
    } else {
      $('#selected_keypoint_color').css("background-color", "#999");
      $('#selected_keypoint_name').html("Various ("+selectedIndexes.length+" keypoints)");  
    }
    
    this.message("Changed selection. Currently selecting " + selectedIndexes.length + " points.")
  }

  // <================ Skeleton displayed?
  toggle_skeleton() {
    this.show_skeleton = !this.show_skeleton;

    $("#skeleton_button").toggleClass('btn-secondary', this.show_skeleton);
    $("#skeleton_button").toggleClass('btn-outline-secondary', !this.show_skeleton);

    this.leaflet.setShowingSkeleton(this.show_skeleton);
  }

  // Lightness
  toggleBrightness() {
    this.lighten = !this.lighten;
    // $("#"+this.leaflet.leafletClass).toggleClass('light', this.lighten);
    // $("#"+this.leaflet_single.leafletClass).toggleClass('light', this.lighten);
    $(".leaflet-image-layer").toggleClass('light', this.lighten);

    $("#lightButton").toggleClass('btn-secondary', this.lighten);
    $("#lightButton").toggleClass('btn-outline-secondary', !this.lighten);
  }

  // <================ Human-edited label
  toggle_frame_edited() {
    var anno = this.get_current_annotation();
    anno.human_edited = !anno.human_edited;
    this.set_ui_frame_edited(anno.human_edited);
  }

  set_ui_frame_edited(human_edited) {
    if (human_edited) {
      $("#human_edit_button").removeClass('btn-danger');
      $("#human_edit_button").addClass('btn-success');
      $("#human_edit_button").html('<i class="far fa-check-square"></i> Human-Edited');
    } else {
      $("#human_edit_button").removeClass('btn-success');
      $("#human_edit_button").addClass('btn-danger');
      $("#human_edit_button").html('<i class="fas fa-times"></i> Not Human-Edited');
    }
  }

  // <================ Difficulty

  // Gets selected difficulty option from buttons
  getDifficulty() {
    let types = ["diff_easy", "diff_med", "diff_hard", "diff_impossible", "diff_na"];
    let diff_id = $("input[name='difficulty']:checked")[0].id;
    var difficulty = types.indexOf(diff_id);
    if (difficulty == types.length - 1) {
      difficulty = -1; // N/A
    }
    return difficulty;
  }

  // Sets difficulty for selected keypoint of selected person
  setDifficulty(difficulty) {
    let frame = this.data.annotations_list[this.frameIdx];
    let person = frame.find(a => a['track_id'] == this.trackList[this.trackIdx]);
    
    var selectedPoints = this.getSelectedIndexes();
    for (var i = 0; i < selectedPoints.length; i++) {
      person.difficulty[selectedPoints[i]] = difficulty;  
    }
    // person.difficulty[this.selectedKeypointIdx] = difficulty;  

    this.message("Set difficulty for " + selectedPoints.length + " points.");

    this.refreshAnnotations();
  }

  // When a difficulty option is selected, this method is called 
  // to update the locally stored difficulty for the selected point
  updateDifficulty() {
    var difficulty = this.getDifficulty();
    this.setDifficulty(difficulty);
  }

  // Sets selected difficutly option in buttons
  showDifficulty(d) {
    // sets the difficulty for difficulty id 'd'.
    // d ranges from 0 to 3 with meaning given by the following 'diffs' array
    let diffs = ["easy", "med", "hard", "impossible", "na"]; 
    if (d == -1) {
      d = diffs.length-1;
    }
    $("input[name='difficulty']").parent('.btn').removeClass('active');
    $("input[name='difficulty']").parent('.btn').prop('checked', false);
    $("#diff_"+diffs[d]).parent('.btn').addClass('active');
    $("#diff_"+diffs[d]).parent('.btn').prop('checked', true)
  }

  // <================ Visibility

  // Gets selected visibility option from buttons
  getVisibility() {
    let types = ["vis_visible", "vis_occluded", "vis_na"];
    let vis_id = $("input[name='visibility']:checked")[0].id;
    var visibility = types.indexOf(vis_id);
    if (visibility == types.length - 1) {
      visibility = -1; // N/A
    }
    return visibility;
  }

  // Sets visibility for selected keypoint of selected person
  setVisibility(visibility) {
    let frame = this.data.annotations_list[this.frameIdx];
    let person = frame.find(a => a['track_id'] == this.trackList[this.trackIdx]);
    
    var selectedPoints = this.getSelectedIndexes();
    for (var i = 0; i < selectedPoints.length; i++) {
      person.visibility[selectedPoints[i]] = visibility;  
    }
    // person.visibility[this.selectedKeypointIdx] = visibility;

    this.message("Set visibility for " + selectedPoints.length + " points.");
  }

  // When a visibility option is selected, this method is called 
  // to update the locally stored visibility for the selected point
  updateVisibility() {
    var visibility = this.getVisibility();
    this.setVisibility(visibility);
  }

  // Sets selected visibility option in buttons
  showVisibility(v) {
    // sets the visibility for visibility id 'v'.
    // v ranges from 0 to 2 with meaning given by the following 'vis' array
    let vis = ["visible", "occluded", "na"]; 
    if (v == -1) {
      v = vis.length-1;
    }
    $("input[name='visibility']").parent('.btn').removeClass('active');
    $("input[name='visibility']").parent('.btn').prop('checked', false);
    $("#vis_"+vis[v]).parent('.btn').addClass('active');
    $("#vis_"+vis[v]).parent('.btn').prop('checked', true)
  }

  // <================ UI


  fillHTMLKeypointsList() {
    var self = this;
    $("#keypoint_list").html("");

    for (var i = 0; i < this.data.categories[0].keypoints.length; i++) {
      let key = this.data.categories[0].keypoints[i];
      let color = this.data.categories[0].keypoints_style[i];
      let id = "keypoints_id_"+i;
      $("#keypoint_list").append(`
        <div class="row keypoint">
          <div class="form-check keypoint_checkbox">
            <input class="form-check-input kp_checkbox_input" type="checkbox" value="" id="check_`+id+`">
          </div>
          <button class="btn btn-xs btn-outline-secondary select_button" id="select_`+id+`">
            <i class="far fa-hand-pointer"></i>
          </button>
          <div class="keypoint_color_container">
            <div class="keypoint_color" style="background-color:`+color+`;"></div>
          </div>
          <div class="keypoint_desc">
            <p>`+key+`</p>
          </div>
          <div class="button">
            <div class="btn-group btn-group-xs" role="group">
              <button class="btn btn-outline-secondary" id="zoom_`+id+`">
                <i class="fas fa-compress"></i> 
                Zoom
              </button>
              <button class="btn btn-outline-secondary" id="isolate_`+id+`">
                <i class="far fa-dot-circle"></i>
                Kalman
              </button>
            </div>
          </div>
        </div>
      `);

      $("#select_"+id).click(function() {
        let idx = parseInt(this.id.split("_")[3]);
        self.setSelectedKeypointIdx(idx);
      });

      $("#isolate_"+id).click(function() {
        let idx = parseInt(this.id.split("_")[3]);
        self.applyKalmanFilter(idx);
      });

      $("#zoom_"+id).click(function() {
        let idx = parseInt(this.id.split("_")[3]);
        console.log("focusing on marker " + idx);
        self.focusOnMarker(idx);
      });
    }

    $(".kp_checkbox_input").bind("change", this.refreshSelection);
  }

  getDataForImage(id, onSuccess, onFail) {
    $.ajax({
      url : '/edit_image/'+id,
      method : 'GET'
    }).done(function(data){
      onSuccess(data);
    }).fail(function(jqXHR, textStatus, errorThrown ){
      console.log(textStatus);
      onFail();
    });
  }

  // getNewAnnotations(id) {
  //   let leaflet = this.leaflet;
  //   this.getDataForImage(id, function(data) {
  //     console.log("SUCCESS");
  //     console.log(data);
  //     leaflet.setAnnotations(data);
  //   }, function() {
  //     console.log("Error getting data for image id " + id);
  //   })
  // }


  getImagePath(view=-1, im_type="image_stiched") {
    // console.log(this.data.image_list[this.frameIdx].file_name);
    // var im_type = "image_stiched";
    if (view != -1) {
      im_type = "images_"+view;
    }
    return "/images/"  + im_type + "/" + this.scene + "/" +
            this.data.image_list[this.frameIdx].file_name;
            // String(this.currentImageId).padStart(6, '0') + ".jpg";
  }

  refreshImage(imagePath, callback=null, for_leaflet_single=false) {
    
    if (for_leaflet_single && !this.SHOW_UNSTICHED_VIEW) {
      if (callback != null) callback();
      return;
    }

    var newImg = new Image;
    let image = this.image;
    let leaflet = this.leaflet;
    let leaftlet2 = this.leaflet_single;
    newImg.onload = function() {
      image = newImg;
      // redraw();

      if (!for_leaflet_single) {
        leaflet.setImage(image);
      }
      
      leaftlet2.setImage(image);
      
      
      if (callback != null) callback();
    }
    newImg.src = imagePath;
  }

  refreshAll(callback=null) {
    this.leaflet.clearAnnotations();
    this.leaflet_single.clearAnnotations();

    var self = this;
    this.refreshImage(this.getImagePath(), function() {
      self.refreshImage(self.getImagePath(-1, "rough_stich"), callback, true);
    });

    this.refreshAnnotations();

    this.setSelectedKeypointIdx(this.selectedKeypointIdx);
  }

  refreshAnnotations() {
    var leafletAnnots = this.data.annotations_list[this.frameIdx];
    if (leafletAnnots.length > 1) {
      let track_id = this.trackList[this.trackIdx];
      let match = leafletAnnots.find(a => a['track_id'] == track_id);
      if (match == null) {
        leafletAnnots = []  
      } else {
        leafletAnnots = [match]
      }
      console.log('track id: ' + track_id);
      
    }
    this.leaflet.setAnnotations(leafletAnnots,
                                 this.data.categories);//, this.keypointIdx);

    if (this.SHOW_UNSTICHED_VIEW) {
      let result = this.stich.stiched_to_unstiched(leafletAnnots);
      this.leaflet_single.setAnnotations(result["annotations"], this.data.categories, result["style_idx"]);
    }

    $("#frameNum").html(String(this.frameIdx));
    $("#person_id").html(this.trackList[this.trackIdx]);

    if (leafletAnnots.length > 0) {
      this.set_ui_frame_edited(leafletAnnots[0].human_edited);
    }
  }

  prev_image(delta=1, callback=null) {
    this.frameIdx -= delta;
    if (this.frameIdx < 0) {
      this.frameIdx = 0;
    }
    this.refreshAll(callback);
  }
  
  next_image(delta=1, callback=null) {
    // console.log(callback);
    this.frameIdx += delta;
    if (this.frameIdx > this.data.annotations_list.length-1) {
      this.frameIdx = this.data.annotations_list.length-1;
    }
    this.refreshAll(callback);
  }

  goToFirstUneditedFrame() {
    for (var i = 0; i < this.data.annotations_list.length; i++) {
      let frame = this.data.annotations_list[i];
      let person = frame.find(a => a['track_id'] == this.trackList[this.trackIdx]);  
      if (person != null && person.human_edited == false) {
        this.frameIdx = i;
        this.refreshAll();
        break;
      }
    }
  }

  togglePlaying(doneCallback) {
    if (this.playing) {
      this.playing = false;
    } else {
      this.playing = true;
      this.play(this, doneCallback);
    }
  }

  play(self=this, doneCallback) {
    // console.log('callback');
    // console.log(self.play);
    if (this.playing && self.frameIdx < self.data.annotations_list.length-1) {
      self.next_image(1, function() {
        setTimeout(function() {
          self.play(self, doneCallback);
        }, 10);
      });
    } else {
      this.playing = false;
      doneCallback();
    }
  }

  pause() {
    this.playing = false;
  }

  rewind() {
    this.playing = false;
    this.frameIdx = 0;
    this.refreshAll();
  }

  next_person() {
    // if (this.personIdx < this.data.annotations_list[0].length-2) {
    //   this.personIdx++;
    //   this.refreshAll();
    // }

    if (this.trackIdx < this.trackList.length-2) {
      this.trackIdx++;
      if (this.LOAD_ALL_DATA) {
        this.refreshAll();        
      } else {
        this.getNewSceneData(this.setSceneData, function() {
          console.log("Error getting scene data");
        });
      }
    }
  }

  prev_person() {
    // if (this.personIdx > 0) {
    //   this.personIdx--;
    //   this.refreshAll();
    // }
    if (this.trackIdx > 0) {
      this.trackIdx--;
      if (this.LOAD_ALL_DATA) {
        this.refreshAll();        
      } else {
        this.getNewSceneData(this.setSceneData, function() {
          console.log("Error getting scene data");
        });
      }
    }
  }

  focusOnAnnotation() {
    this.leaflet.handleAnnotationFocus(0);
  }

  focusOnMarker(markerIdx) {
    this.leaflet.centerLeafletMapOnMarker(markerIdx);
  }
}
