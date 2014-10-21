/*global $:false */
/*global console:false */
/*global Handlebars:false */
/*global tiddlyweb:false */
/*global window:false */

/*
 * Extentions to Handlebars
 */
Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
    switch (operator) {
    case '==':
        return (v1 == v2) ? options.fn(this) : options.inverse(this);
    case '===':
        return (v1 === v2) ? options.fn(this) : options.inverse(this);
    case '<':
        return (v1 < v2) ? options.fn(this) : options.inverse(this);
    case '<=':
        return (v1 <= v2) ? options.fn(this) : options.inverse(this);
    case '>':
        return (v1 > v2) ? options.fn(this) : options.inverse(this);
    case '>=':
        return (v1 >= v2) ? options.fn(this) : options.inverse(this);
    case '&&':
        return (v1 && v2) ? options.fn(this) : options.inverse(this);
    case '||':
        return (v1 || v2) ? options.fn(this) : options.inverse(this);
    default:
        return options.inverse(this);
    }
});

Handlebars.registerHelper('contains', function( collection, item, options ){
    // string check
    if( typeof collection === 'string' ){
        if( collection.search( item ) >= 0 ){
            return options.fn(this);
        }
        else {
            return options.inverse(this);
        }
    }
    // "collection" check (objects & arrays)
    for( var prop in collection ){
        if( collection.hasOwnProperty( prop ) ){
            if( collection[prop] == item ) return options.fn(this);
        }
    }
    return options.inverse(this);
});



var tmanager = (function () {
    
    function Preset(name, space,  tag, title, author) {
        this.name = name;
        this.space = space;
        //this.bag = bag;
        this.tag = tag;
        this.title = title;
        this.author = author;
    }
	
    function SPA(host) {
        this.host = host,
        this.space = '',
        this.tsStore = tiddlyweb.Store(null, false),
        this.tiddlers = [],
        this.workingTiddler = null,
        this.workingTiddlerIndex = -1,
        this.configurationTiddler = '';
    }

    SPA.prototype.getInitialTiddlers = function (tiddlySpace, successCallback, errorCallback) {
        console.log('Getting initial tiddlers from host ' + this.host);

        var spa = this;

        this.tsStore = tiddlyweb.Store(function () {

            var excludeQuery = ' !#excludeLists !#excludeSearch',
                regex = /(_public|_private|_archive)$/;

            spa.tiddlers = spa.tsStore(excludeQuery).unique().sort('title');
            
            console.log('Number of tiddlers returned = ' + spa.tiddlers.length);
            
            //Set the space name by using the default push location
            spa.space = spa.tsStore.getDefaults().pushTo.name.replace(regex, '')

            successCallback();

        } );
    };

    SPA.prototype.getTiddlers = function (tiddlySpace, tiddlyQuery, successCallback, errorCallback) {
        console.log('Submitting query... - ' + tiddlyQuery + ' to host ' + this.host);

        var spa = this;

        var tsStore = tiddlyweb.Store(function (foo) {

            var excludeQuery = ' !#excludeLists !#excludeSearch';

            if (tiddlyQuery !== null && tiddlyQuery !== '') {
                spa.tiddlers = spa.tsStore(tiddlyQuery + excludeQuery).unique().sort('title');
            } else {
                spa.tiddlers = spa.tsStore(excludeQuery).unique().sort('title');
            }

            successCallback(spa.tiddlers);

            console.log('Number of tiddlers returned = ' + spa.tiddlers.length);

        });
    };

    SPA.prototype.getTiddlerDetail = function(tiddlerIndex, flags, successCallback) {
        console.log('Getting tiddler for index position - ' + tiddlerIndex);

        var spa = this;

        this.tsStore.get(this.tiddlers[tiddlerIndex], function (tiddler) {
            
            spa.workingTiddlerIndex = tiddlerIndex;
            
            successCallback(tiddler, flags);
            
        }, true);
    };

    SPA.prototype.saveTiddler = function(tiddler, workingTiddlerIndex, successCallback) {

        var spa = this,
            card_html,
            revision;

        this.tsStore.save(tiddler, function(response, error){
            if (response) {                
                showAlert('alert-success', 'The tiddler has been saved.');

                if (workingTiddlerIndex === -1) {
                    //A new tiddler, so add to the local array                
                    spa.tiddlers.push(tiddler);
                    spa.workingTiddler = response;
                    spa.workingTiddlerIndex = spa.tiddlers.length - 1;
                    currentModalTiddlerIndex = spa.workingTiddlerIndex;
                    workingTiddlerIndex = spa.workingTiddlerIndex;
                }

                spa.getTiddlerDetail(workingTiddlerIndex, 'saved', successCallback);
            } else if (error.name === 'SaveError') {
                showAlert('alert-danger', 'There was a problem saving. Please try again');
            } else if (error.name === 'EmptyError') {
                showAlert('alert-info', 'There was nothing to save.');
            }            
        });
    };

    SPA.prototype.saveConfiguration = function(configuration, successCallback) {

        var spa = this;

        this.configurationTiddler.text = JSON.stringify(configuration);

        this.tsStore.save(this.configurationTiddler, function(response, error){
            
            if (response) {
                showAlert('alert-success', 'Updated configuration has been saved.');
                spa.configurationTiddler = response;                
                successCallback();
            } else if (error.name === 'SaveError') {
                showAlert('alert-danger', 'There was a problem saving the configuration. Please try again');
            } else if (error.name === 'EmptyError') {
                showAlert('alert-info', 'There was nothing to save.');
            }
            
        });
    };

    SPA.prototype.deleteTiddler = function(tiddlerIndex, successCallback) {    
        var spa = this;
        
        if (tiddlerIndex !== -1) {
            console.log('Deleting tiddler');
            console.log(this.tiddlers[tiddlerIndex]);

            successCallback();

            this.tsStore.destroy(this.tiddlers[tiddlerIndex], function(response, error){
                if (response) {
                    successCallback();
                } else if (error.name === 'RemoveError') {
                    showAlert('alert-danger', 'There was a problem deleting. Please try again');
                } else if (error.name === 'EmptyError') {
                    showAlert('alert-info', 'There was nothing to delete.');
                }
            });
        } else {
            console.log('Nothing to delete as tiddler not saved.');
            successCallback();
        }
    };

    SPA.prototype.addTiddler = function(name, type, defaultText, successCallback) {

        //this.tsStore.add(tiddler, true);
        //this.tiddlers.push(tiddler);
        //this.workingTiddlerIndex = this.tiddlers.length - 1;
        //currentModalTiddlerIndex = this.workingTiddlerIndex;
        //successCallback(tiddler);
    }

    SPA.prototype.getWorkingTiddler = function() {
        return this.workingTiddler;
    };

    SPA.prototype.setWorkingTiddler = function(tiddler) {
        this.workingTiddler = tiddler;
    };

    SPA.prototype.updateTiddlerInResultSet = function(tiddlerToReplaceRevision, newTiddler) {
        var indexPos = -1;
        $.each(this.tiddlers, function (index, tiddler) {
            if (tiddler.revision === tiddlerToReplaceRevision) {
                indexPos = index
                return false;
            }
        });
        if (indexPos != -1) {
            this.tiddlers[indexPos] = newTiddler;
        }
    };          
    
    /*
     * Privates
     */
    var mySPA,
        cardTemplate,
        tiddlerModalTemplate,
        currentModalTiddlerIndex,
        slideDetail,
        outgoingSlideDetail,
        configuration,
        tiddlerTitles = [];    

    /*
     * End of privates
     */

    /*
     * Utility functions
     */
    function htmlEncode(value) {
        //create a in-memory div, set it's inner text(which jQuery automatically encodes)
        //then grab the encoded contents back out.  The div never exists on the page.
        return $('<div/>').text(value).html();
    }
    /*
     * End of Utility functions
     */
    
    
    /*
     * Call back functions
     */
    function getInitialTiddlersCallback() {        
        var configurationExists = false,
            configurationTiddlerName ='tManagerConfig',
            configurationExists = false,
            regEx = /(\/\/)([^.]*)(\.)/;

        $.each(mySPA.tiddlers, function (index) {
            if (this.title === configurationTiddlerName) {
                if (mySPA.space === this.uri.match(regEx)[2]) {
                    //The configuration tiddler exists within this space.
                    configurationExists = true;
                }
                return false;
            }            
        });

        //Get or create the config tiddler 
        if (configurationExists) {
            mySPA.tsStore.get(mySPA.tsStore('[[' + configurationTiddlerName + ']]')[0], function (tiddler) {            
                //Now process the config tiddler and render all the others
                mySPA.configurationTiddler = tiddler;
                updatePresets();
                renderTiddlersAsCardsCallback(mySPA.tiddlers);
            }, true);
        } else {
            //Configuration tiddler does not exist, so create the default one
            var configTiddler = new tiddlyweb.Tiddler({
                title: configurationTiddlerName,
                text:  '{"presets":[]}',
                tags:  ['tmanager', 'tmanagerconfig'],
                bag:   new tiddlyweb.Bag(mySPA.space + '_private', mySPA.host)                                     
            });
            mySPA.tsStore.add(configTiddler, true).save(configTiddler, function(tiddler) {
                mySPA.configurationTiddler = tiddler;
                updatePresets();
                renderTiddlersAsCardsCallback(mySPA.tiddlers)
            });
        }
    }
    
    function renderTiddlersAsCardsCallback(tiddlers) {
/*        var col_1_html = '<div class="col-md-4">',
            col_2_html = '<div class="col-md-4">',
            col_3_html = '<div class="col-md-4">',
            item = 0,
            cards_html = '',
            col_check;

        $.each(tiddlers, function () {
            col_check = item % 3;
            this.tiddlerIndex = item;
            switch (col_check) {
            case 0:
                col_1_html += cardTemplate(this);
                cards_html += '<div class="clearfix visible-xs-block cardclearfix"></div>';
                break;
            case 1:
                col_2_html += cardTemplate(this);
                break;
            default:
                col_3_html += cardTemplate(this);
            }

            //cards_html += '<li class="col-md-4">' + cardTemplate(this) + '</li>';
            cards_html +=  cardTemplate(this);
            item = item + 1;
        });

        col_1_html = col_1_html + '</div>';
        col_2_html = col_2_html + '</div>';
        col_3_html = col_3_html + '</div>';
*/
        var item = 0,
            cards_html = '',
            col_check;

        //Empty the tiddler titles array, but keeping the same reference so that the typeahead control is updated
        tiddlerTitles.length = 0;

        $.each(tiddlers, function () {
            col_check = item % 3;
            this.tiddlerIndex = item;
            if (col_check === 0) {
                cards_html += '<div class="clearfix visible-xs-block cardclearfix"></div>';
            }
            //cards_html += '<li class="col-md-4">' + cardTemplate(this) + '</li>';
            cards_html +=  cardTemplate(this);
            tiddlerTitles.push({title:this.title, id:this.revision});
            item = item + 1;
        });

        //$("#cards").html('<ul class="list-unstyled">'  + cards_html + '</ul>');
        $('#cards').html(cards_html);

        //Add the toggle to the new cards for the expand/collapse chevron
        $('[data-toggle=expand-panel]').click(function () {
            $('i', this).toggleClass('fa fa-chevron-up fa-2x');
            $('i', this).toggleClass('fa fa-chevron-down fa-2x');
            $('.panel-body', $(this).parent().parent().parent()).toggleClass('expand');
        });

        //Resert the overall expand and collapse button
        if ($('.sidebar-right-toggle i').hasClass('fa-compress')) {
            $('.sidebar-right-toggle i').toggleClass('fa fa-expand');
            $('.sidebar-right-toggle i').toggleClass('fa fa-compress');
        }
        checkScrollbarVisibility();
    }
    
    function getTiddlerDetailSuccessCallback(data, direction) {

        var workingTiddlerRevision = null; 

        if (mySPA.getWorkingTiddler() !== null) {
            workingTiddlerRevision = mySPA.getWorkingTiddler().revision;
        }

        mySPA.setWorkingTiddler(null);

        renderTiddlerDetail(data, direction);

        if (direction !== null) {
            if (direction === 'deleted') {
                direction = 'next';                
            } else if (direction === 'saved') {
                //update the tiddler in the main page body
                revision = data.revision;
                card_html =  $(cardTemplate(data));
                
                if ($('#tiddler-content-' + workingTiddlerRevision).html() !== '') {

                    if (data.type === 'image/svg+xml') {
                        $('#tiddler-content-' + revision, card_html).html(data.text);
                    } else if (data.type === 'image/png' || data.type === 'image/jpeg') {
                        $('#tiddler-content-' + revision, card_html).html('<img src="' + data.uri + '"/>');
                    } else if (data.render) {
                        //card_html.find('#tiddler-content-' + revision).html(data.render);
                        $('#tiddler-content-' + revision, card_html).html(data.render);
                    } else {
                        $('#tiddler-content-' + revision, card_html).html('<pre>' + htmlEncode(data.text) + '</pre>');
                    }
                }

                if ($('#card_' + workingTiddlerRevision + ' .panel .panel-body').hasClass('expand')) {                    
                    //var tree = $(card_html);
                    card_html.find('.panel-body').addClass('expand');
                    $('i.expand-toggle', card_html).removeClass('fa fa-chevron-down fa-2x');
                    $('i.expand-toggle', card_html).addClass('fa fa-chevron-up fa-2x');
                }

                //Add the toggle to the new cards for the expand/collapse chevron
                card_html.find('[data-toggle=expand-panel]').click(function () {
                    card_html.find($('i', this).toggleClass('fa fa-chevron-up fa-2x'));
                    card_html.find($('i', this).toggleClass('fa fa-chevron-down fa-2x'));
                    card_html.find($('.panel-body', $(this).parent().parent().parent()).toggleClass('expand'));
                });

                $('#card_' + workingTiddlerRevision).replaceWith(card_html);  

                //replace the old tiddler in the tiddler array
                mySPA.updateTiddlerInResultSet(workingTiddlerRevision, data);
            }

            if (direction === 'next' || direction === 'prev') {
                $('#modalCarousel').carousel(direction);    
            }

        }
    }

    function getTiddlerDetailForEditSuccessCallback(data, flags) {
        var editArea = $('#modalCarousel .carousel-inner .item.active .modal-dialog .modal-content .modal-body');

        if (data.type === 'text/html') {
            
            var iFrameHeight = $('iframe', editArea).css('height').replace('px','');

            editArea.html('<textarea class="form-control" rows="15"></textarea>');

            console.log(iFrameHeight);

//style: "sceditor.jquery.sceditor.default.min.css",

            $('textarea', editArea).sceditor({
                    plugins: "xhtml",
                    style: "bootstrap.min.css",
                    width: "99%",
                    height: iFrameHeight,
                    emoticonsEnabled: false,
                    resizeHeight: false,
                    resizeWidth: false,
                    toolbarExclude: "pastetext,emoticon,youtube,date,time,ltr,rtl,print,maximize"
            });            

            $('textarea', editArea).sceditor('instance').val(data.text);
        } else {
            editArea.html('<textarea class="form-control" rows="15"></textarea>');
            $('textarea', editArea).val(data.text);    
        }


        

        $('#modalCarousel .carousel-inner .item.active .edit-button').toggleClass('button-display-toggle');
        $('#modalCarousel .carousel-inner .item.active .save-button').toggleClass('button-display-toggle');

        mySPA.setWorkingTiddler(data);
    }

    function addTiddlerSuccessCallback(data) {        
        renderTiddlerDetail(data, 'add');
    }

    function deleteTiddlerSuccessCallback() {
        var removedTiddlerRevision,
            cardObject;

        $('#modalCarousel .carousel-inner .item.active .modal-dialog .modal-content').fadeOut('fast').queue(            
            function() {

                if (currentModalTiddlerIndex !== -1) {
                    //Delete the tiddler

                    //Record the detail of the tiddler which has been removed
                    removedTiddlerRevision = mySPA.tiddlers[currentModalTiddlerIndex].revision;
                    
                    //Remove from the tiddler array
                    mySPA.tiddlers.splice(currentModalTiddlerIndex, 1);

                    //Make the nearest visible the current tiddler
                    currentModalTiddlerIndex = getNearestVisisbleTiddlerIndex(removedTiddlerRevision, 'next');


                    //Update the main page to reflect the tiddler has been removed            
                    cardObject = $('#card_' + removedTiddlerRevision);                

                    cardObject.fadeTo(1000, 0, function() {

                        cardObject.remove();

                        $('.cardclearfix').remove();

                        $('.card').each(function( index, card) {
                            if (index % 3 === 0) {                
                                $( card ).before('<div class="clearfix visible-xs-block cardclearfix"></div>');
                            }
                        });

                    });                

                    //Update the typeahead details
                    var indexToDelete = -1;
                    $.each( tiddlerTitles, function( index, value ){
                        if (value.id === removedTiddlerRevision) {
                            indexToDelete = index;
                            return false;
                        }                
                    });

                    tiddlerTitles.splice(indexToDelete, 1);

                    if (currentModalTiddlerIndex != -1) {
                        mySPA.getTiddlerDetail(currentModalTiddlerIndex, 'deleted', getTiddlerDetailSuccessCallback);
                    } else {
                        $('#tiddlerModal').modal('hide');
                    }
                } else {
                    //Nothing to delete as the tiddler has not been saved.
                    $('#tiddlerModal').modal('hide');
                }
                showAlert('alert-success', 'The tiddler has been deleted.');
            }
        );
        checkScrollbarVisibility();   
    }

    function getTiddlerDetailErrorCallback(error) {
        showAlert('alert-danger', 'Error retrieving data: ' + error);
        console.log('Error retrieving data: ' + error);
    }
    
    function retrievalErrorCallback(error) {
        showAlert('alert-danger', 'Error retrieving data: ' + error);
        console.log('Error retrieving data: ' + error);
    }
    
    /*
     * End of callback functions
     */
    

    /*
     * Private functions
     */
     function closePresetModalAndUpdatePresets() {        
        $('#savePresetModal').modal('hide');
        updatePresets();

        $('#presetItems').val($('#spPresetName').val());
        updateSearchForm();
     }
    function updatePresets() {
        configuration = JSON.parse(mySPA.configurationTiddler.text);

        $('#presetItems').empty().append('<option value="" disabled selected>Preset</option>');

        $.each(configuration.presets, function () {
            $('#presetItems').append('<option value="' + this.name + '">' + this.name + '</option>');
        });    
    }    
    function updateSearchForm() {
        var selectedPreset = $('#presetItems').val();
        $.each(configuration.presets, function () {
            if (this.name === selectedPreset) {
                $('#space').val(this.space);
                //$('#bag').val(this.bag);
                $('#tag').val(this.tag);
                $('#title').val(this.title);
                $('#author').val(this.author);
            }
        });
    }
    function resetSearchForm() {
        $('#presetItems')[0].selectedIndex = 0;        
        $('#sidebar-form input').val('');        
    }
 
    function renderTiddlerDetail(data, direction) {

        var slideData,
            pageHeight,
            windowHeight;

        if (slideDetail !== null && direction !== null && direction !== 'saved') {
            outgoingSlideDetail = slideDetail;
        }

        slideDetail = data;        

        if (direction === null || direction === 'saved' || direction === 'add') {
            slideData = {
                slide1: data,
                slide2: outgoingSlideDetail
            };
        } else {
            slideData = {
                slide1: outgoingSlideDetail,
                slide2: data
            };
        }

        var showCarouselControls = $('.carousel-control').is(":visible") || direction === null;

        $('#tiddlerModal').html(tiddlerModalTemplate(slideData));

        if (!showCarouselControls || direction === 'add') {
            $('.carousel-control').hide();
        }

        var iFrame;

        if (data.type === 'text/html') {
                        

/*            var cssLink = document.createElement("link") 
            cssLink.href = "style.css"; 
            cssLink .rel = "stylesheet"; 
            cssLink .type = "text/css"; 
            frames['frame1'].document.body.appendChild(cssLink);
*/

            if (direction === null || direction === 'saved' || direction === 'add') {
                iFrame = '#slide1IFrame';
                document.getElementById('slide1IFrame').contentWindow.document.write(data.text);            
            } else {
                iFrame = '#slide2IFrame';
                document.getElementById('slide2IFrame').contentWindow.document.write(data.text);
            };
            var head = $(iFrame).contents().find("head");                
            head.append($("<link/>", 
                { rel: "stylesheet", href: "bootstrap.min.css", type: "text/css" }));

        }
        

        pageHeight = $(window).height();
        //windowHeight = Math.floor(pageHeight * 0.9);

        $('.carousel-control.left').click(function () {
            if ($('#modalCarousel .carousel-inner .item.active .save-button').is(":visible")) {
                checkForUnsavedChanges('prev');
            } else {
                slideCard('prev');
            }
        });
        $('.carousel-control.right').click(function () {
            if ($('#modalCarousel .carousel-inner .item.active .save-button').is(":visible")) {
                checkForUnsavedChanges('next');
            } else {
                slideCard('next');
            }      
        });


        $('#tiddlerModal .modal-content').css({
            'max-height': (Math.floor(pageHeight * 0.9)) + 'px'
        });

        if (!iFrame) {
            $('#tiddlerModal .modal-body').css({
                'max-height': (Math.floor(pageHeight * 0.5)) + 'px'
            });
        } else {
            $(iFrame).css({
                'height': (Math.floor(pageHeight * 0.5)) + 'px'
            });
        }


        if (direction === 'deleted') {
            //$('#modalCarousel').find(".item.active .modal-dialog .modal-content").css('background-color', 'red');
            $('#modalCarousel').find('.item.active').addClass('deleted');
        }

        if (direction === null) {
            $('#tiddlerModal').modal('show');
        } else if (direction === 'add') {
            //Had to put this event capture in to ensure the editor is sized correctly when displayed.
            $('#tiddlerModal').on('shown.bs.modal', function() {
                $('#tiddlerModal').off('shown.bs.modal');
                getTiddlerDetailForEditSuccessCallback(data, null);                
            });

            $('#tiddlerModal').modal('show');            
        }

    }


    function getTiddlerIndexFromRevision(revision) {    
        var tiddlerIndex = -1;
        $.each(mySPA.tiddlers, function( index, tiddler ) {
            if (revision === tiddler.revision) {
                tiddlerIndex = index;
                return false;
            }
        });    
        return tiddlerIndex;;
    }



    function getNearestVisisbleTiddlerIndex(tiddlerRevision, direction) {
        var nearestTiddlerIndex = -1,
            nearestRevision;

        if (direction === 'prev') {

            nearestRevision = $('#card_' + tiddlerRevision).prevAll('.card').filter(':visible:first').attr('id');

            if (!nearestRevision) {
                nearestRevision = $('#card_' + tiddlerRevision).nextAll('.card').filter(':visible:last').attr('id');
            }

            if (!nearestRevision) {
                nearestRevision = tiddlerRevision;
            } else {
                //Remove the card_ part to get the revision
                nearestRevision = nearestRevision.replace('card_', '');
            }
        } else {

            nearestRevision = $('#card_' + tiddlerRevision).nextAll('.card').filter(':visible:first').attr('id');

            if (!nearestRevision) {
                nearestRevision = $('#card_' + tiddlerRevision).prevAll('.card').filter(':visible:last').attr('id');
            }

            if (!nearestRevision) {
                nearestRevision = tiddlerRevision;
            } else {
                //Remove the card_ part to get the revision
                nearestRevision = nearestRevision.replace('card_', '');
            }
        }

        //Get the index
        nearestRevision = parseInt(nearestRevision);
        $.each(mySPA.tiddlers, function(index, tiddler) {
            if (tiddler.revision === nearestRevision) {
                nearestTiddlerIndex = index;
                return false;
            }
        });

        return nearestTiddlerIndex;
    }

    function deleteTiddler() {
        mySPA.deleteTiddler(currentModalTiddlerIndex, deleteTiddlerSuccessCallback);
    }

    function addTiddler() {
        var tiddler = new tiddlyweb.Tiddler('New one from tmanager');
        tiddler.type = 'text/html';
        tiddler.text = 'Default Text';
        tiddler.permissions = ['write','delete'];
        mySPA.setWorkingTiddler(tiddler);
        currentModalTiddlerIndex = -1;
        renderTiddlerDetail(tiddler, 'add');
    }

    function savePreset() {
        var saveName = $('#spPresetName').val().trim(),
            existingPreset = false,
            newPreset;
    
        if ($('#presetSaveForm').data('bootstrapValidator').validate().isValid()) {

            $.each(configuration.presets, function(index, preset) {
                if (saveName === preset.name) {
                    existingPreset = true;
                    preset.space = $('#spSpace').val();
                    //preset.bag = $('#spBag').val();
                    preset.tag  = $('#spTag').val();
                    preset.title = $('#spTitle').val();
                    preset.author = $('#spAuthor').val();            
                }
            });

            if (!existingPreset) {
                //newPreset = new Preset(saveName, $('#spSpace').val(), $('#spBag').val(), $('#spTag').val(), $('#spTitle').val(), $('#spAuthor').val());
                newPreset = new Preset(saveName, $('#spSpace').val(), $('#spTag').val(), $('#spTitle').val(), $('#spAuthor').val());
                configuration.presets.push(newPreset);
            };

            mySPA.saveConfiguration(configuration, closePresetModalAndUpdatePresets);

        };
    }

    function confirmSavePreset() {    
        var options = {
                'backdrop' : 'static'
            },
            presetForm = $('#presetSaveForm');
        
        $('#spPresetName', presetForm).val($('#presetItems').val());
        $('#spSpace', presetForm).val($('#space').val());
        //$('#spBag').val($('#bag').val());
        $('#spTag', presetForm).val($('#tag').val());
        $('#spTitle', presetForm).val($('#title').val());
        $('#spAuthor', presetForm).val($('#author').val());
        $('#savePresetModal').modal(options);        
    }

    function expandCollapseAll() {
        if ($('.sidebar-right-toggle i').hasClass('fa-expand')) {
            $('.card .panel-heading i.expand-toggle').removeClass('fa fa-chevron-up fa-2x');
            $('.card .panel-heading i.expand-toggle').addClass('fa fa-chevron-down fa-2x');
            $('.card .panel-body').closest('div').removeClass('expand');
        } else {
            $('.card .panel-heading .expand-toggle').trigger('click');
            $('.card .panel-heading i.expand-toggle').removeClass('fa fa-chevron-down fa-2x');
            $('.card .panel-heading i.expand-toggle').addClass('fa fa-chevron-up fa-2x');
            $('.card .panel-body').closest('div').addClass('expand');
        }
    }

    function showAlert(alertType, alertText) {
        var alertContainer = $('div.alert-offcanvas'),
            exisingTop = alertContainer.css('top');
//find('div.alert').animate('{top:"100%", opacity:0.0, height:"400px"}', 'slow')
        //console.log(existingStyle);    
        $('div.alert', alertContainer).addClass(alertType).html(alertText).parent().fadeIn(500).delay(1000).animate(
            {'top':'-=100px', 'opacity':'0'},
            '2000', function() {                            
                alertContainer.css({ 'top': exisingTop, 'opacity': '1', 'display': 'none' });
                $('div.alert', this).removeClass(alertType);
            }
        );
        
        //$('.alert-offcanvas .alert').addClass(alertType).html(alertText).delay(2000).removeClass(alertType);        
    }
    
    function scrollToID(id, speed){
        var offSet = 40,
            scrollToObject = $(id),
            currentObjLocation = (scrollToObject.offset().top - offSet),
            currentScrollLocation = $('#main').scrollTop(),
            //targetOffset2 = $('#main').scrollTop() + (scrollToObject.offset().top - offSet),
            targetOffset = currentScrollLocation + currentObjLocation;

        //console.log('div position top = ' + $(id).position().top + ', div offset = ' + $(id).offset().top + ', offset top = ' + $(id).offset().top);
        
        if (targetOffset != currentScrollLocation) {
            //Scroll and animate
            $('#main').animate({scrollTop:targetOffset}, speed, function () {
                $(scrollToObject).fadeTo(100, 0.1).fadeTo(200, 1.0).fadeTo(100, 0.1).fadeTo(200, 1.0);
            });
        } else {
            //Just animate
            $(scrollToObject).fadeTo(100, 0.1).fadeTo(200, 1.0).fadeTo(100, 0.1).fadeTo(200, 1.0);
        }
    }

    function scrollToCard(cardTitle, fullMatch){
        var searchStr = cardTitle.toUpperCase(),
            regEx,
            divID = null;

        if (fullMatch) {
            regEx = "^" + searchStr + "$";
        } else {
            regEx = "^" + searchStr;
        }

        $.each(mySPA.tiddlers, function(index, tiddler) {
            if (tiddler.title.toUpperCase().match(regEx)) {
                divID = '#card_' + tiddler.revision;
                return false;
            }
        });

        if (divID != null) {
            scrollToID(divID, 2000);
        }
    }

    function substringMatcher(strs) {
      return function findMatches(q, cb) {
        var matches, substrRegex, matchedNamesReqEx;
     
        // an array that will be populated with substring matches
        matches = [];

        matchedNamesReqEx = '';
     
        // regex used to determine if a string contains the substring `q`
        substrRegex = new RegExp(q, 'i');
     
        // iterate through the pool of strings and for any string that
        // contains the substring `q`, add it to the `matches` array
        $.each(strs, function(i, str) {
          if (substrRegex.test(str)) {
            // the typeahead jQuery plugin expects suggestions to a
            // JavaScript object, refer to typeahead docs for more info
            matches.push({ value: str });
            matchedNamesReqEx += '(' + str + ')';
          }
        });
     
        cb(matches);
        console.log('matches :: ' + matchedNamesReqEx);
        //$.each( $(".card .panel-heading h4 [name^='news-top-']"), function () {
        //    $(this).hide();
        //});
      };
    };

    function substringTiddlerMatcher(tiddlers) {
      return function findMatches(q, cb) {
        var matches, substrRegex, matchedNamesReqEx;
     
        // an array that will be populated with substring matches
        matches = [];

        matchedCardIds = '';
     
        // regex used to determine if a string contains the substring `q`
        substrRegex = new RegExp(q, 'i');
     
        // iterate through the pool of strings and for any string that
        // contains the substring `q`, add it to the `matches` array
        $.each(tiddlers, function(i, tiddler) {
          if (substrRegex.test(tiddler.title)) {
            // the typeahead jQuery plugin expects suggestions to a
            // JavaScript object, refer to typeahead docs for more info
            matches.push({ value: tiddler.title });
            matchedCardIds += '#card_' + tiddler.id + ', ';
          }
        });
     
        cb(matches);

        if (matchedCardIds !== '') {
            //remove the last comma
            matchedCardIds = matchedCardIds.slice(0,-2);
        }

        showFilteredCards(matchedCardIds);

      };
    };   

    function showFilteredCards(cardIds) {
        if (cardIds) {
            if (cardIds !== '') {
                $('.card').not(matchedCardIds).hide(); 
                $('.card ' + matchedCardIds).show();
            } else {
                //No match so hide them all
                $('.card ').hide();
            }
        } else {
            //No ids passed in, so show them all
            $('.card ').show();
        }

        $('.cardclearfix').remove();

        $('.card').filter(':visible').each(function( index, card) {
            if (index % 3 === 0) {                
                $( card ).before('<div class="clearfix visible-xs-block cardclearfix"></div>');
            }
        });
        checkScrollbarVisibility();
    }

    function hasVerticalScroll(node){
        if(node == undefined){
            if(window.innerHeight){
                return document.body.offsetHeight> innerHeight;
            }
            else {
                return  document.documentElement.scrollHeight > 
                    document.documentElement.offsetHeight ||
                    document.body.scrollHeight>document.body.offsetHeight;
            }
        }
        else {
            return node.scrollHeight> node.offsetHeight;
        }
    }

    function checkScrollbarVisibility() {
        if (hasVerticalScroll($('#main').get(0))) {
            var sidebarright = $('#sidebar-right');
            if (!(sidebarright).hasClass('sidebar-right-scrollbar-visible-toggle')) { 
                sidebarright.addClass('sidebar-right-scrollbar-visible-toggle');
                sidebarright.removeClass('sidebar-right-scrollbar-not-visible-toggle');                                      
            };
        } else {
            var sidebarright = $('#sidebar-right');
            if (!(sidebarright).hasClass('sidebar-right-scrollbar-not-visible-toggle')) {
                sidebarright.addClass('sidebar-right-scrollbar-not-visible-toggle');
                sidebarright.removeClass('sidebar-right-scrollbar-visible-toggle');
            }                
        };
    }


    function addToLocalStorage(name, value) {
        if (typeof(Storage) != "undefined") {
            // Store
            localStorage.setItem(name, value);
        }
    }

    function getFromLocalStorage(name) {
        var result = null;
        if (typeof(Storage) != "undefined") {
            // Store
            result = localStorage.getItem(name)
        }
        return result;
    }

    function checkForUnsavedChanges(callingAction) {    
        var options = {
            'backdrop' : 'static'
        };
        
        $("#btnIgnoreEdit").attr("onclick","tmanager.handleIgnoreEdit('" + callingAction + "');");

        $('#unsavedChangesConfirmModal').modal(options);
    }

     function slideCard (direction) {

        currentModalTiddlerIndex = getNearestVisisbleTiddlerIndex(mySPA.tiddlers[currentModalTiddlerIndex].revision, direction);

        mySPA.getTiddlerDetail(currentModalTiddlerIndex, direction, getTiddlerDetailSuccessCallback);
    }



    /*
     * End of private functions
     */
    
    /*
     * Bind UI events
     */
    function bindUIEvents() {
        //Side Bar Form
        $('#sidebar-form').submit(function (event) {
            var spaceText = $('#sidebar-form #space').val().trim(),
                tagText = $('#sidebar-form #tag').val().trim(),
                titleText = $('#sidebar-form #title').val().trim(),
                authorText = $('#sidebar-form #author').val().trim(),
                queryText = '';

            if (spaceText !== '') {
                queryText = queryText.concat('@').concat(spaceText).concat(' ');
            }

            if (tagText !== '') {
                queryText = queryText.concat('#').concat(tagText).concat(' ');
            }
            if (titleText !== '') {
                queryText = queryText.concat('[[').concat(titleText).concat(']] ');
            }
            if (authorText !== '') {
                queryText = queryText.concat('+').concat(authorText).concat(' ');
            }

            mySPA.getTiddlers(spaceText, queryText, renderTiddlersAsCardsCallback, retrievalErrorCallback);            

            //addToLocalStorage('latestQuery', queryText);

            event.preventDefault();
        });
        
        $('#btnToggle').click(function() {
            if ($(this).hasClass('on')) {
                $('#main .col-md-6').addClass('col-md-4').removeClass('col-md-6');
                $(this).removeClass('on');
            } else {
                $('#main .col-md-4').addClass('col-md-6').removeClass('col-md-4');
                $(this).addClass('on');
            }
        });
        
        //Downdowm menu
        $('.dropdown-menu li a').click(function () {
            var selText = $(this).text();
            $(this).parents('.input-group-btn').find('.dropdown-toggle').html(selText + ' <span class="caret"></span>');
        });
        
        //Configure the data toggle for the side bar
        $('[data-toggle=offcanvas]').click(function () {
            $('.row-offcanvas').toggleClass('active');
            $('.alert-offcanvas').toggleClass('active');
            $('.sidebar-toggle i').toggleClass('fa fa-chevron-right');
            $('.sidebar-toggle i').toggleClass('fa fa-chevron-left');
        });

        //The filterBy entry box
        var filterBy = $('#filterBy');
        filterBy.typeahead({
            hint: false,
            highlight: true,
            minLength: 1
        },
        {
            name: 'tiddlerTitles',
            displayKey: 'value',
            source: substringTiddlerMatcher(tiddlerTitles)
        });

        filterBy.bind('typeahead:selected', function(obj, datum, name) {            
            scrollToCard(datum.value, true);
            $('#filterBy').typeahead('close');
        });

  /*      scrollTo.bind('typeahead:opened', function(obj, datum, name) {            
            if (scrollTo.val() === '') {
                scrollTo.attr("placeholder","");
            }
        });
*/


        filterBy.keypress(function (e) {
            if (e.which == 13) {
                scrollToCard($('#filterBy').val(), false);
                $('#filterBy').typeahead('close');              
            }
        });

        filterBy.keyup(function () {
            if ($('#filterBy').val() === '') {
                console.log('empty');
                showFilteredCards();
            }
        });        


   /*    scrollTo.typeahead.change(function () {
            if ($('#scrollTo').val() === '') {
                showFilteredCards();
            }
        });*/

/*        scrollTo.focus(function () {            
            //scrollTo.autocomplete("search","");
            if (scrollTo.val() === '') {
                //auto expand the scrollto typeahead
                ev = $.Event("keydown");
                ev.keyCode = ev.which = 40;
                $(this).trigger(ev);
                //$('#scrollTo').typeahead('open');
                return true
            }
        });
*/
        $('.twitter-typeahead').css('vertical-align', 'middle');
    
        //Configure the data toggle for the expand/collapse all button
        $('[data-toggle=expand]').click(function () {
            $('.sidebar-right-toggle i').toggleClass('fa fa-expand');
            $('.sidebar-right-toggle i').toggleClass('fa fa-compress');
            expandCollapseAll();
        });

        $('[data-toggle=addnew]').click(function () {
            addTiddler();
        });

        $('#btnDeleteTiddler').click(function() {            
            deleteTiddler();
        });

        //Attach the save preset function
        $('#save-preset').click(function () {
            confirmSavePreset();
        });        

        $('#presetItems').on('change', function () {
            updateSearchForm();
        });        

        $('#btnSavePreset').click(function () {
            savePreset();
        });

        $('#presetSaveForm input').keypress(function (e) {
            if (e.which == 13) {
                $('#btnSavePreset').trigger('click');
            }
        });

        $('#presetSaveForm').bootstrapValidator({
            message: 'This value is not valid',
            feedbackIcons: {
                valid: 'fa fa-check-square',
                invalid: 'fa fa-exclamation-triangle',
                validating: 'fa fa-cog'
            },
            fields: {
                spPresetName: {
                    validators: {
                        notEmpty: {
                            message: 'The preset name is required'
                        }
                    }
                },
                spSpace: {                    
                    validators: {
                    }
                },
                spTag: {
                    validators: {                        
                    }
                },
                spTitle: {
                    validators: {                        
                    }
                },
                spAuthor: {
                    validators: {                        
                    }
                }
            }
        });

        $('#savePresetModal').on('shown.bs.modal', function() {
            $('#presetSaveForm').bootstrapValidator('resetForm');
            $('#spPresetName').focus();
        });

        $('#reset-search-form').click(function () {
            resetSearchForm();
        });

        $('#tiddlerModal').on('hide.bs.modal', function(e){    
            if ($('#modalCarousel .carousel-inner .item.active .save-button').is(":visible")) {
                checkForUnsavedChanges('close');
                e.preventDefault();
            }
        });

        $( window ).resize(function() {
            checkScrollbarVisibility();
        });
    }
    
    /*
     * End of Binding UI events
     */
    
  // Return an object exposed to the public
  return {
 
    /*
     * Public functions
     */	  
	  
    init: function () {
        // Get the HTML to represent the templates
        var cardTemplateScript = $('#cardTemplate').html(),
            tiddlerModalTemplateScript = $('#tiddlerModalTemplate').html();
    	
    	mySPA = new SPA('http://' + window.location.hostname);
        
        //Bind the UI
        bindUIEvents();
        
        //Perform the initial search for tiddlers
        if ($('#container').length === 0) {
            // Get the list of tiddlers
            mySPA.getInitialTiddlers(mySPA.host, getInitialTiddlersCallback, retrievalErrorCallback);
        }
        
        // Compile the templates
        cardTemplate = Handlebars.compile(cardTemplateScript);
        tiddlerModalTemplate = Handlebars.compile(tiddlerModalTemplateScript);  

        $('#filterBy').focus();      
    },
    
    getCardBody: function (revision) {        
        if ($('#tiddler-content-' + revision).html() === '') {
            
        	var tiddlerIndex = getTiddlerIndexFromRevision(revision),  
                tiddler = mySPA.tiddlers[tiddlerIndex];
            
            mySPA.tsStore.get(tiddler, function (tiddler) {
                if (tiddler.type === 'image/svg+xml') {
                    $('#tiddler-content-' + revision).html(tiddler.text);
                } else if (tiddler.type === 'image/png' || tiddler.type === 'image/jpeg') {
                    $('#tiddler-content-' + revision).html('<img src="' + tiddler.uri + '"/>');
                } else if (tiddler.render) {
                    $('#tiddler-content-' + revision).html(tiddler.render);
                } else {
                    $('#tiddler-content-' + revision).html('<pre>' + htmlEncode(tiddler.text) + '</pre>');
                }
                checkScrollbarVisibility();
            }, true);            
        } else {
            checkScrollbarVisibility();
        }
        // else if ($('#card_' + hashCode + ' .panel .panel-body').hasClass('expand') === false) {
        //    $('#card_' + hashCode + ' .panel .panel-body').addClass('expand');
        //}
    },
    
    showModalCarousel: function (revision) {
        currentModalTiddlerIndex = getTiddlerIndexFromRevision(revision);  
        mySPA.getTiddlerDetail(currentModalTiddlerIndex, null, getTiddlerDetailSuccessCallback);
    },
    
    editTiddler: function () {
        mySPA.getTiddlerDetail(currentModalTiddlerIndex, null, getTiddlerDetailForEditSuccessCallback);
    },

    saveTiddler: function () {

        if (mySPA.getWorkingTiddler() !== null) {

            var tiddler = mySPA.getWorkingTiddler();

            if (tiddler.type !== 'text/html') {
                tiddler.text = $('#modalCarousel .carousel-inner .item.active .modal-dialog .modal-content .modal-body textarea').val();
            } else {
                tiddler.text = $('#modalCarousel .carousel-inner .item.active .modal-dialog .modal-content .modal-body textarea').sceditor('instance').val();
            }

            mySPA.setWorkingTiddler(tiddler);

            mySPA.saveTiddler(tiddler, currentModalTiddlerIndex, getTiddlerDetailSuccessCallback);

        }
    },
    
    confirmDeleteTiddler: function () {    
        var options = {
            'backdrop' : 'static'
        },
        deleteTiddlerTitle;

        if (currentModalTiddlerIndex !== -1) {
            deleteTiddlerTitle = mySPA.tiddlers[currentModalTiddlerIndex].title;
        } else {
            deleteTiddlerTitle = $('#tiddlerModal .item.active .modal-header h2').html();
        }

        $('#deleteConfirmModal .modal-dialog .modal-content .modal-body .tiddlerName').html('<h2>' + deleteTiddlerTitle + '</h2>');

        $('#deleteConfirmModal').modal(options);
    },

    handleIgnoreEdit: function (callingAction) {
        
        if (callingAction === 'next') {
            slideCard('next');
        } else if (callingAction === 'prev') {
            slideCard('prev');
        } else if (callingAction === 'close') {
            $('#modalCarousel .carousel-inner .item.active .edit-button').toggleClass('button-display-toggle');
            $('#modalCarousel .carousel-inner .item.active .save-button').toggleClass('button-display-toggle');
            $('#tiddlerModal').modal('hide');
        }
    }

  };
})();

(function() {
    tmanager.init();
})();



