/**
 * jspsych.js
 * Josh de Leeuw
 * 
 * documentation: https://github.com/jodeleeuw/jsPsych/wiki
 *
 **/ 
(function($) {
    jsPsych = (function() {

        //
        // public object
        //
        var core = {};

        //
        // private class variables
        //

        // options
        var opts = {};
        // exp structure
        var exp_blocks = [];
        // flow control
        var curr_block = 0;
        // everything loaded?
        var initialized = false;
        // target DOM element
        var DOM_target;
        // time that the experiment began
        var exp_start_time;
       
        //
        // public methods
        //

        // core.init creates the experiment and starts running it
        //		display_element is an HTML element (usually a <div>) that will display jsPsych content
        //		options is an object: {
        //			"experiment_structure": an array of blocks specifying the experiment
        //			"finish": function to execute when the experiment ends
        //		}
        //
        core.init = function(options) {

            // reset the key variables
            exp_blocks = [];
            opts = {};
            initialized = false;
            curr_block = 0; // zero-indexing, so zero means 1 (pretty sure)

            // check if there is a body element on the page
            var default_display_element = $('body'); 
            //'body' refers to the location on the page where the text will be shown (remember PTB concept of 'Screen' we've talked about before.)
            //'jspsych-target' has been set as  div within body (in exp.html)
            if (default_display_element.length === 0) { // if body doesn't exist, create it. But you probably want to set <body> in the html yourself
                $(document.documentElement).append($('<body>'));
                default_display_element = $('body');
            }

            var defaults = {
                'display_element': default_display_element,
                'on_finish': function(data) { // seems to be initializing 'on_finish', on_trial_start, etc. as undefined so you can later plug things in
                    return undefined; // not sure what function(data) is, appears to be set on line 94
                },
                'on_trial_start': function() { // not called in exp.html, possible we may want to do something with this later? But not sure what it does or how it works.
                    return undefined;
                },
                'on_trial_finish': function() { // not called in exp.html, possible we may want to do something with this later? But not sure what it does or how it works.
                    return undefined;
                },
                'on_data_update': function(data) { //unclear if gets called after every trial (which is what we want) or after on_finish (which we assume means after the entire experiment has finished).
                    return undefined;
                }
            };

            // import options
            opts = $.extend({}, defaults, options); // not sure what $ means or why it is called here. it seems like $ can stand in as a convention for an oft-used function (http://stackoverflow.com/questions/3107543/what-is-the-symbol-used-for-in-javascript). $ appears to be set on line 8 of this file. Also not sure what 'import options' refers to. Importing from db?

            // set target
            DOM_target = opts.display_element; // DOM = Document Object Model. we think a DOM is a effectively a "tree" that contains all the pieces of the html document. we think this is setting a DOM object within `display_element` (which has not been specified yet)

            // add CSS class to DOM_target
            DOM_target.addClass('jspsych-display-element'); // CSS styling for `jspsych-display-element` is set in static/css/jspsych.css

            run();
        };

        // core.data returns all of the data objects for each block as an array
        //      where core.data[0] = data object from block 0, etc...
        // if flatten is true, then the hierarchical structure of the data
        // is removed and each array entry will be a single trial.

        core.data = function() {
            var all_data = []; // initialize all_data variable
            
            for (var i = 0; i < exp_blocks.length; i++) { // hypothesis is that exp_blocks is set in experiment_blocks.test_block (or another experiment_blocks object) is set within exp.html and contains button presses, RTs, etc.
                all_data[i] = exp_blocks[i].data; // this is a "for loop" that takes the data in each separate exp_block and concatenates it into a single all_data variable that gets passed to on_finish or on_data_update within core.init
            }

            return all_data; // return the all_data variable that now contains all of the data across the experiment blocks
        };

        

        // core.progress returns an object with the following properties
        // 		total_blocks: the number of total blocks in the experiment
        //		total_trials: the number of total trials in the experiment
        //		current_trial_global: the current trial number in global terms
        // 					i.e. if each block has 20 trials and the experiment is
        //					currently in block 2 trial 10, this has a value of 30.
        //		current_trial_local: the current trial number within the block.
        //		current_block: the current block number.

        core.progress = function() {

            var total_trials = 0;
            for (var i = 0; i < exp_blocks.length; i++) {
                total_trials += exp_blocks[i].num_trials;
            }

            var current_trial_global = 0;
            for (var i = 0; i < curr_block; i++) {
                current_trial_global += exp_blocks[i].num_trials;
            }
            current_trial_global += exp_blocks[curr_block].trial_idx;

            var obj = {
                "total_blocks": exp_blocks.length,
                "total_trials": total_trials,
                "current_trial_global": current_trial_global,
                "current_trial_local": exp_blocks[curr_block].trial_idx,
                "current_block": curr_block
            };

            return obj;
        };

        // core.startTime() returns the Date object which represents the time that the experiment started.

        core.startTime = function() {
            return exp_start_time;
        };

        // core.totalTime() returns the length of time in ms since the experiment began

        core.totalTime = function() {
            return (new Date()).getTime() - exp_start_time.getTime();
        };

        // core.preloadImage will load images into the browser cache so that they appear quickly when
        // used during a trial. 
        //  images: array of paths to images
        //  callback_complete: a function with no arguments that calls when loading is complete
        //  callback_load: a function with a single argument that calls whenever an image is loaded
        //                  argument is the number of images currently loaded.

        core.preloadImages = function(images, callback_complete, callback_load) {

            // flatten the images array
            images = flatten(images);

            var n_loaded = 0;
            var loadfn = (typeof callback_load === 'undefined') ? function() {} : callback_load;
            var finishfn = (typeof callback_complete === 'undefined') ? function() {} : callback_complete;

            for (var i = 0; i < images.length; i++) {
                var img = new Image();

                img.onload = function() {
                    n_loaded++;
                    loadfn(n_loaded);
                    if (n_loaded == images.length) {
                        finishfn();
                    }
                };

                img.src = images[i];
            }
        };
        
        core.getDisplayElement = function() {
            return DOM_target;
        }

        //
        // private functions //
        //
        function run() {
            // take the experiment structure and dynamically create a set of blocks
            exp_blocks = new Array(opts.experiment_structure.length); // need to come back to this once we figure out where opts.experiment_structure is set

            // iterate through block list to create trials
            for (var i = 0; i < exp_blocks.length; i++) {

                // check to make sure plugin is loaded
                var plugin_name = opts.experiment_structure[i].type;
                if (typeof jsPsych[plugin_name] == 'undefined') {
                    throw new Error("Failed attempt to create trials using plugin type " + plugin_name + ". Is the plugin loaded?");
                }

                var trials = jsPsych[plugin_name]["create"].call(null, opts["experiment_structure"][i]); // call is a way to invoke a "function method" (see: http://yehudakatz.com/2011/08/11/understanding-javascript-function-invocation-and-this/). 

                exp_blocks[i] = createBlock(trials); //createBlock is defined on line 224
            }

            // record the start time
            exp_start_time = new Date();

            // begin! - run the first block
            exp_blocks[0].next();
        }

        function nextBlock() { // iterate the block counter. this seems to be how it knows to progress linearly through block IDs (1 -> 2 -> 3, etc.)
            curr_block += 1;
            if (curr_block == exp_blocks.length) {
                finishExperiment();
            }
            else {
                exp_blocks[curr_block].next(); // .next method progresses from the current object.block to the next "sibling" in this object. seems to progress in sequential order. we are not sure why you can't just use a numeric index. We think it is iterating sequentially by 1 position, but not sure. We think next is definied on line 232 of this file.
            }
        }

        function createBlock(trial_list) {
            var block = {
                trial_idx: -1, // this is like setting the index to 0, but remember that here 0 = 1 because javascript is zero-indexed

                trials: trial_list, // trial_list comes from line 202-->204

                data: [], // initializing data

                next: function() {

                    // call on_trial_finish() 
                    //     if not very first trial
                    //		and not the last call in this block (no trial due to advance in block)
                    if (typeof this.trials[this.trial_idx + 1] != "undefined" && (curr_block != 0 || this.trial_idx > -1)) {
                        opts.on_trial_finish();
                    };

                    this.trial_idx = this.trial_idx + 1; // incremement trial_idx

                    var curr_trial = this.trials[this.trial_idx]; // find current trial in this.trials

                    if (typeof curr_trial == "undefined") { // if current trial is undefined, execute done() because experiment is complete
                        return this.done();
                    }

                    // call on_trial_start()
                    opts.on_trial_start(); // on_trial_start is one of the experiment_blocks that's initialized on line 66

                    do_trial(this, curr_trial); // defined on line 273. potentially where trial actually gets presented? (like `flip screen` in PTB)
                },

                writeData: function(data_object) {
                    this.data[this.trial_idx] = data_object;
                    opts.on_data_update(data_object); //we think writeData is function that's interfacing between currently active variables in javascript and the participants.db database, but we are unsure how frequently these two things are interacting (ie, after every trial? at the end of the block? at the end of the experiment?)
                },


                done: nextBlock, // is a function. iterate to the "next" block using .next as an iterator method. nextBlock is defined on 214. We think this could be parsed as "when this is DONE, call nextBlock"

                num_trials: trial_list.length // update the number of trials based on the length of the trial list
            };

            return block; // when you run createBlock, the output is a variable 'block' that contains `trials`, `data`, and `num_trials`
        }

        function finishExperiment() {
            opts["on_finish"].apply((new Object()), [core.data()]); // when your trial block is the last block (current trial block == length of trial blocks; remember that there's zero indexing so that's why this works), end the current trial block and save the data (see line 137 in exp.html)
        } 

        function do_trial(block, trial) { // we have no idea what this does and "do_trial" does not appear in any other files in this directory
            // execute trial method
            jsPsych[trial.type]["trial"].call(this, DOM_target, block, trial, 1);
        }

        return core; // we think core is the placeholder variable for the overarching experiment structure, simililar to 'this', but we think 'this' is trial and block specific and is therefore contained within 'core'
    })();
    
    jsPsych.dataAPI = (function() { // we think this is an anonymous function because it has the syntax `(function (){//guts go here}())`
        
        var module = {};
        
        // core.dataAsCSV returns a CSV string that contains all of the data
        //      append_data is an option map object that will append values
        //      to every row. for example, if append_data = {"subject": 4},
        //      then a column called subject will be added to the data and
        //      it will always have the value 4.
        // module.dataAsCSV = function(append_data) {
        //     var dataObj = jsPsych.data();
        //     return JSON2CSV(flattenData(dataObj, append_data));
        // }; // gets called within the localSave module   

        // module.localSave = function(filename, format, append_data) {
            
        //     var data_string;
            
        //     if(format == 'JSON' || format == 'json') {
        //         data_string = JSON.stringify(flattenData(jsPsych.data(), append_data));
        //     } else if(format == 'CSV' || format == 'csv') {
        //         data_string = module.dataAsCSV(append_data);
        //     } else {
        //         throw new Error('invalid format specified for jsPsych.dataAPI.localSave');
        //     }
            
        //     saveTextToFile(data_string, filename);
        // }; // not called anywhere else. We suspect this is the method we would want to use if we are saving a local version of the data after each trial
        
        module.getTrialsOfType = function(trial_type){ // this gets call in exp.html on line 105. We think that you can feed in a given trial type (eg, single stim, multiple stim) and this function (module?) will return `trials`
            var data = jsPsych.data();
            
            data = flatten(data);
            
            var trials = [];
            for(var i = 0; i < data.length; i++){
                if(data[i].trial_type == trial_type){
                    trials.push(data[i]);
                }
            }
            
            return trials;
        }; // when commented this out and ran in debug mode, experiment ran but didn't get a "done" screen. We would have expected that the experiment would have broken prior to starting the first trial because it would not have known what type the trial was meant to be.
        
        // module.displayData = function(format) {
        //     format = (typeof format === 'undefined') ? "json" : format.toLowerCase();
        //     if(format != "json" && format != "csv") {
        //         console.log('Invalid format declared for displayData function. Using json as default.');
        //         format = "json";
        //     }
            
        //     var data_string;
            
        //     if(format == 'json') {
        //         data_string = JSON.stringify(flattenData(jsPsych.data()), undefined, 1);
        //     } else {
        //         data_string = module.dataAsCSV();
        //     } 
            
        //     var display_element = jsPsych.getDisplayElement(); // display_element = DOM_target
            
        //     display_element.append($('<pre>', {
        //         html: data_string // hypothesis: this is formatting, saying that data_string should be displayed within <html></html> in the DOM_target
        //     }));
        // } // This does not get called by any of the files in this project. When commeted out, no changes in experimental behavior. 
        
        // // private function to save text file on local drive. We are still unclear on private functions, but we think that these are functions that take a variable (or set a variable) where there can be changes made to this variable within the scope of the private function but these changes cannot get passed back out to other functions.
        // function saveTextToFile(textstr, filename) {
        //     var blobToSave = new Blob([textstr], {
        //         type: 'text/plain'
        //     });
        //     var blobURL = "";
        //     if (typeof window.webkitURL !== 'undefined') {
        //         blobURL = window.webkitURL.createObjectURL(blobToSave);
        //     }
        //     else {
        //         blobURL = window.URL.createObjectURL(blobToSave);
        //     }
            
        //     var display_element = jsPsych.getDisplayElement();
            
        //     display_element.append($('<a>', {
        //         id: 'jspsych-download-as-text-link',
        //         href: blobURL,
        //         css: {
        //             display: 'none'
        //         },
        //         download: filename,
        //         html: 'download file'
        //     }));
        //     $('#jspsych-download-as-text-link')[0].click();
        // } // This module does not get called anywhere. 
        
        //
        // A few helper functions to handle data format conversion
        //
        // function flattenData(data_object, append_data) { // append_data is whatever string or set of key-value pairs that you want appended to the data_object

        //     append_data = (typeof append_data === undefined) ? {} : append_data; // This statement can be read as if append_data == undefined then (this is the ?) return {} else (this is the :) append_data

        //     var trials = [];

        //     // loop through data_object and append the thing from append_data to the end. We believe this is "flattening" because you are basically reducing the dimensions from 2 separate "variables" to a single data_object
        //     for (var i = 0; i < data_object.length; i++) {
        //         for (var j = 0; j < data_object[i].length; j++) {
        //             var data = $.extend({}, data_object[i][j], append_data);
        //             trials.push(data);
        //         }
        //     }

        //     return trials;
        // } // We think this gets called in functions (modules) that are related either to saving out data or displaying data, but none of the other functions that call (dataAsCSV, dispalyData, localSave) it seem to be used so can comment this module out. 
        
        // this function based on code suggested by StackOverflow users:
        // http://stackoverflow.com/users/64741/zachary
        // http://stackoverflow.com/users/317/joseph-sturtevant
        // function JSON2CSV(objArray) {
        //     var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
        //     var line = '';
        //     var result = '';
        //     var columns = [];

        //     var i = 0;
        //     for (var j = 0; j < array.length; j++) {
        //         for (var key in array[j]) {
        //             var keyString = key + "";
        //             keyString = '"' + keyString.replace(/"/g, '""') + '",';
        //             if ($.inArray(key, columns) == -1) {
        //                 columns[i] = key;
        //                 line += keyString;
        //                 i++;
        //             }
        //         }
        //     }

        //     line = line.slice(0, - 1);
        //     result += line + '\r\n';

        //     for (var i = 0; i < array.length; i++) {
        //         var line = '';
        //         for (var j = 0; j < columns.length; j++) {
        //             var value = (typeof array[i][columns[j]] === 'undefined') ? '' : array[i][columns[j]];
        //             var valueString = value + "";
        //             line += '"' + valueString.replace(/"/g, '""') + '",';
        //         }

        //         line = line.slice(0, - 1);
        //         result += line + '\r\n';
        //     }

        //     return result;
        // } // Converts JSON to CSV and is called earlier on line 292 by dataToCSV. We think this is conceptually similar to something like `cell2csv` in matlab
        
        return module;
        
    })();
    
    jsPsych.turk = (function() {
        
         // turk info
        var turk_info;
        
        var module = {};
        
        // core.turkInfo gets information relevant to mechanical turk experiments. returns an object
        // containing the workerID, assignmentID, and hitID, and whether or not the HIT is in
        // preview mode, meaning that they haven't accepted the HIT yet.
        module.turkInfo = function(force_refresh) { // gets called in submitToTurk
            // default value is false
            force_refresh = (typeof force_refresh === 'undefined') ? false : force_refresh;
            // if we already have the turk_info and force_refresh is false
            // then just return the cached version.
            if (typeof turk_info !== 'undefined' && !force_refresh) {
                return turk_info;
            } else {

                var turk = {};

                var param = function(url, name) {
                    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
                    var regexS = "[\\?&]" + name + "=([^&#]*)";
                    var regex = new RegExp(regexS);
                    var results = regex.exec(url);
                    return (results == null) ? "" : results[1];
                };

                var src = param(window.location.href, "assignmentId") ? window.location.href : document.referrer;

                var keys = ["assignmentId", "hitId", "workerId", "turkSubmitTo"];
                keys.map(

                function(key) {
                    turk[key] = unescape(param(src, key));
                });

                turk.previewMode = (turk.assignmentId == "ASSIGNMENT_ID_NOT_AVAILABLE");

                turk.outsideTurk = (!turk.previewMode && turk.hitId === "" && turk.assignmentId == "" && turk.workerId == "")

                turk_info = turk;

                return turk;
            }

        };

        // core.submitToTurk will submit a MechanicalTurk ExternalHIT type

        module.submitToTurk = function(data) { // not called anywhere, but we suspect this is because this is the sample experiment and they're assuming we won't be using MTurk

            var turkInfo = core.turkInfo();
            var assignmentId = turkInfo.assignmentId;
            var turkSubmitTo = turkInfo.turkSubmitTo;

            if (!assignmentId || !turkSubmitTo) return;

            var dataString = [];

            for (var key in data) {

                if (data.hasOwnProperty(key)) {
                    dataString.push(key + "=" + escape(data[key]));
                }
            }

            dataString.push("assignmentId=" + assignmentId);

            var url = turkSubmitTo + "/mturk/externalSubmit?" + dataString.join("&");

            window.location.href = url;
        }
        
        return module;
        
    })();
    
    jsPsych.randomization = (function() {
        
        var module = {};
        
        module.repeat = function(array, repetitions, unpack) {
           
            var arr_isArray = Array.isArray(array);
            var rep_isArray = Array.isArray(repetitions);
            
            // if array is not an array, then we just repeat the item
            if(!arr_isArray){
                if(!rep_isArray) {
                    array = [array];
                    repetitions = [repetitions];
                } else {
                    repetitions = [repetitions[0]];
                    console.log('Unclear parameters given to randomizeSimpleSample. Multiple set sizes specified, but only one item exists to sample. Proceeding using the first set size.');
                }
            } else {
                if(!rep_isArray) {
                    var reps = [];
                    for(var i = 0; i < array.length; i++){
                        reps.push(repetitions);            
                    }
                    repetitions = reps;
                } else {
                    if(array.length != repetitions.length) {
                        // throw warning if repetitions is too short,
                        // throw warning if too long, and then use the first N
                    }
                }
            }
            
            // should be clear at this point to assume that array and repetitions are arrays with == length
            var allsamples = [];
            for(var i = 0; i < array.length; i++){
                for(var j = 0; j < repetitions[i]; j++){
                    allsamples.push(array[i]);
                }
            }
            
            var out = shuffle(allsamples);
            
            if(unpack) { out = unpackArray(out);  }
            
            return shuffle(out);   
        }
        
        module.factorial = function(factors, repetitions, unpack){
    
            var factorNames = Object.keys(factors);
            
            var factor_combinations = [];
            
            for(var i = 0; i < factors[factorNames[0]].length; i++){
                factor_combinations.push({});
                factor_combinations[i][factorNames[0]] = factors[factorNames[0]][i];
            }
            
            for(var i = 1; i< factorNames.length; i++){
                var toAdd = factors[factorNames[i]];
                var n = factor_combinations.length;
                for(var j = 0; j < n; j++){
                    var base = factor_combinations[j];
                    for(var k = 0; k < toAdd.length; k++){
                        var newpiece = {};
                        newpiece[factorNames[i]] = toAdd[k];
                        factor_combinations.push($.extend({}, base, newpiece));
                    }
                }
                factor_combinations.splice(0,n);
            }
            
            repetitions = (typeof repetitions === 'undefined') ? 1 : repetitions;
            var with_repetitions = module.repeat(factor_combinations, repetitions, unpack);
            
            return with_repetitions;
        }
        
        function unpackArray(array) { // can't figure this function out. It gets called as the third argument in jsPsych.randomize. Plans are to email jsPsych man to ask.
            
            var out = {};
        
            for(var i = 0; i < array.length; i++){
                var keys = Object.keys(array[i]); // we think `keys` is actually calling the function `getKeys` which is set on line 875. We think it is extracting all of the keys (as in key/value pairs) from `Object` and returning the key names as an array
                for(var k = 0; k < keys.length; k++){
                    if(typeof out[keys[k]] === 'undefined') {
                        out[keys[k]] = [];
                    }
                    out[keys[k]].push(array[i][keys[k]]);
                }
            }
            
            return out;
        }
        
        function shuffle(array) { // randomly shuffles the order of the stimuli. Takes whatever array is the first input to jsPsych.randomize (which, in this case, is `test_stimuli`) as the names of the stimuli, etc.
          var m = array.length, t, i;
        
          // While there remain elements to shuffle…
          while (m) {
        
            // Pick a remaining element…
            i = Math.floor(Math.random() * m--);
        
            // And swap it with the current element.
            t = array[m];
            array[m] = array[i];
            array[i] = t;
          }
        
          return array;
        }
        
        return module;
        
    })();
    
    jsPsych.pluginAPI = (function() {
        
        // keyboard listeners
        var keyboard_listeners = [];
        
        var module = {};
        
        module.getKeyboardResponse = function(callback_function, valid_responses, rt_method, persist) { // gets called within the jspsych-single-stim.js plugin. We think this defines the guts of how participant (in AMT-speak, `worker`) keypresses are recorded.

            rt_method = (typeof rt_method === 'undefined') ? 'date' : rt_method;
            if (rt_method != 'date' && rt_method != 'performance') {
                console.log('Invalid RT method specified in getKeyboardResponse. Defaulting to "date" method.');
                rt_method = 'date';
            }

            var start_time;
            if (rt_method == 'date') {
                start_time = (new Date()).getTime();
            }
            if (rt_method == 'performance') {
                start_time = performance.now();
            }

            var listener_id;
            
            var listener_function = function(e) {

                var key_time;
                if (rt_method == 'date') {
                    key_time = (new Date()).getTime();
                }
                if (rt_method == 'performance') {
                    key_time = performance.now();
                }

                var valid_response = false;
                if (typeof valid_responses === 'undefined' || valid_responses.length === 0) {
                    valid_response = true;
                }
                for (var i = 0; i < valid_responses.length; i++) {
                    if (typeof valid_responses[i] == 'string') {
                        if(typeof keylookup[valid_responses[i]] !== 'undefined'){
                            if(e.which == keylookup[valid_responses[i]]) {
                                valid_response = true;
                            }
                        } else {
                            throw new Error('Invalid key string specified for getKeyboardResponse');
                        }
                    } else if (e.which == valid_responses[i]) {
                        valid_response = true;
                    }
                }

                if (valid_response) {
                    
                    var after_up = function(up) {
                        
                        if(up.which == e.which) {
                            $(document).off('keyup', after_up);
                        
                            if($.inArray(listener_id, keyboard_listeners) > -1) {
                                
                                if(!persist){
                                    // remove keyboard listener
                                    module.cancelKeyboardResponse(listener_id);
                                }
                                
                                callback_function({
                                    key: e.which,
                                    rt: key_time - start_time
                                });
                            }
                        }
                    };
                    
                    $(document).keyup(after_up);
                }
            };

            $(document).keydown(listener_function);
            
            // create listener id object
            listener_id = {type: 'keydown', fn: listener_function};
            
            // add this keyboard listener to the list of listeners
            keyboard_listeners.push(listener_id);
            
            return listener_id;
            
        };
        
        module.cancelKeyboardResponse = function(listener) { // we think this turns off listening during the ITI. Gets called on line 75 of `jspsych-stingle-stim.js`
            // remove the listener from the doc
            $(document).off(listener.type, listener.fn);
            
            // remove the listener from the list of listeners
            if($.inArray(listener, keyboard_listeners) > -1) {
                keyboard_listeners.splice($.inArray(listener, keyboard_listeners), 1);
            }
        };
        
        module.cancelAllKeyboardResponses = function() { // this is not called
            for(var i = 0; i< keyboard_listeners.length; i++){
                $(document).off(keyboard_listeners[i].type, keyboard_listeners[i].fn);
            }
            keyboard_listeners = [];
        };
        
        // keycode lookup associative array
        var keylookup = {
            'backspace': 8,
            'tab': 9,
            'enter': 13,
            'shift': 16,
            'ctrl': 17,
            'alt': 18,
            'pause': 19,
            'capslock': 20,
            'esc': 27,
            'space':32,
            'spacebar':32,
            ' ':32,
            'pageup': 33,
            'pagedown': 34,
            'end': 35,
            'home': 36,
            'leftarrow': 37,
            'uparrow': 38,
            'rightarrow': 39,
            'downarrow': 40,
            'insert': 45,
            'delete': 46,
            '0': 48,
            '1': 49,
            '2': 50,
            '3': 51,
            '4': 52,
            '5': 53,
            '6': 54,
            '7': 55,
            '8': 56,
            '9': 57,
            'a': 65,
            'b': 66,
            'c': 67,
            'd': 68,
            'e': 69,
            'f': 70,
            'g': 71,
            'h': 72,
            'i': 73,
            'j': 74,
            'k': 75,
            'l': 76,
            'm': 77,
            'n': 78,
            'o': 79,
            'p': 80,
            'q': 81,
            'r': 82,
            's': 83,
            't': 84,
            'u': 85,
            'v': 86,
            'w': 87,
            'x': 88,
            'y': 89,
            'z': 90,
            'A': 65,
            'B': 66,
            'C': 67,
            'D': 68,
            'E': 69,
            'F': 70,
            'G': 71,
            'H': 72,
            'I': 73,
            'J': 74,
            'K': 75,
            'L': 76,
            'M': 77,
            'N': 78,
            'O': 79,
            'P': 80,
            'Q': 81,
            'R': 82,
            'S': 83,
            'T': 84,
            'U': 85,
            'V': 86,
            'W': 87,
            'X': 88,
            'Y': 89,
            'Z': 90,
            '0numpad': 96,
            '1numpad': 97,
            '2numpad': 98,
            '3numpad': 99,
            '4numpad': 100,
            '5numpad': 101,
            '6numpad': 102,
            '7numpad': 103,
            '8numpad': 104,
            '9numpad': 105,
            'multiply': 106,
            'plus': 107,
            'minus': 109,
            'decimal': 110,
            'divide': 111,
            'F1': 112,
            'F2': 113,
            'F3': 114,
            'F4': 115,
            'F5': 116,
            'F6': 117,
            'F7': 118,
            'F8': 119,
            'F9': 120,
            'F10': 121,
            'F11': 122,
            'F12': 123,
            '=': 187,
            ',': 188,
            '.': 190,
            '/': 191,
            '`': 192,
            '[': 219,
            '\\': 220,
            ']': 221
        };
        
        //
        // These are public functions, intended to be used for developing plugins.
        // They aren't considered part of the normal API for the core library.
        //

        module.normalizeTrialVariables = function(trial, protect) { // gets called on line 49 of `jspsych-single-stim.js` We are unsure why/where it gets used, but from comments in plugin file, behavior seems sort of like `eval`.

            protect = (typeof protect === 'undefined') ? [] : protect;

            var keys = getKeys(trial); // getKeys is set as a function in this section on line 920. 

            var tmp = {};
            for (var i = 0; i < keys.length; i++) {

                var process = true;
                for (var j = 0; j < protect.length; j++) {
                    if (protect[j] == keys[i]) {
                        process = false;
                        break;
                    }
                }

                if (typeof trial[keys[i]] == "function" && process) {
                    tmp[keys[i]] = trial[keys[i]].call();
                }
                else {
                    tmp[keys[i]] = trial[keys[i]];
                }

            }

            return tmp;

        };

        // if possible_array is not an array, then return a one-element array
        // containing possible_array
        module.enforceArray = function(params, possible_arrays) { // gets called on line 18 of `jspsych-single-stim.js`

            // function to check if something is an array, fallback
            // to string method if browser doesn't support Array.isArray
            var ckArray = Array.isArray || function(a) {
                    return toString.call(a) == '[object Array]';
                };

            for (var i = 0; i < possible_arrays.length; i++) {
                if(typeof params[possible_arrays[i]] !== 'undefined'){
                    params[possible_arrays[i]] = ckArray(params[possible_arrays[i]]) ? params[possible_arrays[i]] : [params[possible_arrays[i]]];
                }
            }

            return params;
        };
        
        function getKeys(obj) { // We think this is set as a function and not a module becuase it's only called by another module within the scope of the current API anonymous funciton. It gets called on line 875 in the current file.
            var r = [];
            for (var k in obj) {
                if (!obj.hasOwnProperty(k)) continue;
                r.push(k);
            }
            return r;
        }
        
        return module;
    })();
    
    // methods used in multiple modules
    
    // private function to flatten nested arrays
    function flatten(arr, out) {
        out = (typeof out === 'undefined') ? [] : out;
        for (var i = 0; i < arr.length; i++) {
            if (Array.isArray(arr[i])) {
                flatten(arr[i], out);
            }
            else {
                out.push(arr[i]);
            }
        }
        return out;
    }

})(jQuery); // we think that jQuery is being passed in as a global variable to the jsPsych function
