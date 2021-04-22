class JRDB_Stich {
    
    constructor() {
        this.STICH_URL = '/static/stich/stich.json'
    }

    load(performLoad, onSuccess, onFailure) {
        if (!performLoad) onSuccess();

        var self = this;
        $.ajax({
          url: this.STICH_URL,
          method: 'GET'
        }).done(function(data){
          // console.log(data);
          console.log("Stich loaded!");
          self.stich = data;
          onSuccess();
        }).fail(function(jqXHR, textStatus, errorThrown ){
          console.log(textStatus);
          onFailure();
        });
    }

    stiched_to_unstiched(annotations) {
        var results = {
            "annotations": [],
            "style_idx": []
        }
        for (var i = 0; i < annotations.length; i++) {
            var ann = annotations[i];

            var new_kps = [];
            var styles = [];

            for (var k = 0; k < ann.keypoints.length/3; k++) {
                var x = Math.round(ann.keypoints[k*3]);
                var y = Math.round(ann.keypoints[k*3+1]);
                var x_y = x + "_" + y;

                console.log(x_y);
                let unstiched_map = this.stich[x_y];
                console.log(unstiched_map);

                for (var j = 0; j < unstiched_map.length; j++) {
                    let x_converted = ((unstiched_map[j][0]+2)*752 + unstiched_map[j][1]) % 3760;
                    let y_converted = unstiched_map[j][2];
                    
                    new_kps.push(x_converted);
                    new_kps.push(y_converted);
                    new_kps.push(1);

                    styles.push(k);
                }
            }

            results["annotations"].push({"keypoints": new_kps, "category_id": 1});
            results["style_idx"].push(styles);
        }
        console.log(results);
        return results;
    }
}