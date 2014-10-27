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
        logToConsole('Getting initial tiddlers from host ' + this.host);

        var spa = this;

        this.tsStore = tiddlyweb.Store(function () {

            var excludeQuery = ' !#excludeLists !#excludeSearch',
                regex = /(_public|_private|_archive)$/;

            spa.tiddlers = spa.tsStore(excludeQuery).unique().sort('title');
            
            logToConsole('Number of tiddlers returned = ' + spa.tiddlers.length);
            
            //Set the space name by using the default push location
            spa.space = spa.tsStore.getDefaults().pushTo.name.replace(regex, '')

            successCallback();

        } );
    };

    SPA.prototype.getTiddlers = function (tiddlySpace, tiddlyQuery, successCallback, errorCallback) {
        logToConsole('Submitting query... - ' + tiddlyQuery + ' to host ' + this.host);

        var spa = this;

        var tsStore = tiddlyweb.Store(function (foo) {

            var excludeQuery = ' !#excludeLists !#excludeSearch';

            if (tiddlyQuery !== null && tiddlyQuery !== '') {
                spa.tiddlers = spa.tsStore(tiddlyQuery + excludeQuery).unique().sort('title');
            } else {
                spa.tiddlers = spa.tsStore(excludeQuery).unique().sort('title');
            }

            successCallback(spa.tiddlers);

            logToConsole('Number of tiddlers returned = ' + spa.tiddlers.length);

        });
    };

    SPA.prototype.getTiddlerDetail = function(tiddlerIndex, flags, successCallback) {
        logToConsole('Getting tiddler for index position - ' + tiddlerIndex);

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

        this.tsStore.save(tiddler, function(savedTiddler, error){
            if (savedTiddler) {                
                showAlert('alert-success', 'The tiddler has been saved.');

                if (workingTiddlerIndex === -1) {
                    //A new tiddler, so add to the local array in the correct position             
                    spa.tiddlers.push(savedTiddler);
                    spa.tiddlers.sort(function (a, b) {
                        return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
                    });
                    $.each(spa.tiddlers, function (index, value) {
                        if (value === savedTiddler) {
                            spa.workingTiddlerIndex = index;
                            return false;
                        }
                    });
                    spa.workingTiddler = savedTiddler;                    
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
        if (tiddlerToReplaceRevision) {
            //Revision number available for matching
            $.each(this.tiddlers, function (index, tiddler) {
                if (tiddler.revision === tiddlerToReplaceRevision) {
                    indexPos = index
                    return false;
                }
            });
        } else {
            //No revision yet (a new tiddler) so use the title and bag
            $.each(this.tiddlers, function (index, tiddler) {
                if (tiddler.title === newTiddler.title && tiddler.bag.name === newTiddler.bag.name) {
                    indexPos = index
                    return false;
                }
            });
        }
        if (indexPos != -1) {
            this.tiddlers[indexPos] = newTiddler;
        }
    };

    SPA.prototype.changePrivacy = function(tiddlerIndex, makePrivate, successCallback) {            

            var spa = this,
                tiddler = this.tiddlers[tiddlerIndex],
                isPrivate = tiddler.bag && /_private$/.test(tiddler.bag.name),
                defaultBag = this.tsStore.getDefaults().pushTo,
                newBag,
                previousTiddlerRevision = tiddler.revision;

            

            if (isPrivate) {
                newBag = tiddler.bag.name.replace(/_private$/, '_public');                
            } else {
                newBag = tiddler.bag.name.replace(/_public$/, '_private');
            }

            if (newBag !== (tiddler.bag && tiddler.bag.name)) {
                //deleteBagLater = tiddler.bag;
                this.tsStore.remove(tiddler);
                tiddler.bag = new tiddlyweb.Bag(newBag, '/');
                this.tsStore.add(tiddler);
                this.tsStore.save(tiddler, function(response, error){
                    if (response) {
                        showAlert('alert-success', 'Privacy changed.');
                        successCallback(response, previousTiddlerRevision);
                    } else if (error.name === 'SaveError') {
                        showAlert('alert-danger', 'There was a problem changing the privacy. Please try again');
                    } else if (error.name === 'EmptyError') {
                        showAlert('alert-info', 'There was nothing to change privacy on.');
                    }
                });
            }

/*            var $el = $(ev.target),
                isPrivate = $el.prop('checked'),
                defaultBag = store.getDefaults().pushTo,
                newBag;

            if (isPrivate) {
                newBag = defaultBag.name.replace(/_public$/, '_private');
            } else {
                newBag = defaultBag.name.replace(/_private$/, '_public');
            }

            if (newBag !== (tiddler.bag && tiddler.bag.name)) {
                deleteBagLater = tiddler.bag;
                store.remove(tiddler);
                tiddler.bag = new tiddlyweb.Bag(newBag, '/');
                store.add(tiddler);
            }
*/
        }        
    
    /*
     * Privates
     */
    var mySPA,
        cardTemplate,
        slideTemplate,
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

        var item = 0,
            cards_html = '',
            col_check;

        $.each(tiddlers, function () {
            col_check = item % 3;
            this.tiddlerIndex = item;
            if (col_check === 0) {
                cards_html += '<div class="clearfix visible-xs-block cardclearfix"></div>';
            }   
            
            cards_html +=  renderCard(this);

            item = item + 1;
        });

        updateTypeahead();

        //$("#cards").html('<ul class="list-unstyled">'  + cards_html + '</ul>');
        $('#cards').html(cards_html);

        //Add the toggle to the new cards for the expand/collapse chevron
        $('[data-toggle=expand-panel]').click(function () {
            $('i', this).toggleClass('fa fa-chevron-up fa-2x').toggleClass('fa fa-chevron-down fa-2x');
            $('.panel-body', $(this).parent().parent().parent()).toggleClass('expand');
        });

        //Resert the overall expand and collapse button
        if ($('.sidebar-right-toggle i').hasClass('fa-compress')) {
            $('.sidebar-right-toggle i').toggleClass('fa fa-expand').toggleClass('fa fa-compress');
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
                
                card_html =  $(renderCard(data));

                //Add the toggle to the new card for the expand/collapse chevron
                card_html.find('[data-toggle=expand-panel]').click(function () {
                    card_html.find($('i', this).toggleClass('fa fa-chevron-up fa-2x').toggleClass('fa fa-chevron-down fa-2x'));
                    card_html.find($('.panel-body', $(this).parent().parent().parent()).toggleClass('expand'));
                });


                //replace the old tiddler in the tiddler array
                mySPA.updateTiddlerInResultSet(workingTiddlerRevision, data);

                if (workingTiddlerRevision) {
                    //Existing tiddler saved
                    if ($('#tiddler-content-' + workingTiddlerRevision).html() !== '') {
                        //Update existing card to reflect the new content
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
                        $('i.expand-toggle', card_html).removeClass('fa fa-chevron-down fa-2x').addClass('fa fa-chevron-up fa-2x');
                    }

                    $('#card_' + workingTiddlerRevision).replaceWith(card_html);  
                                        
                } else {
                    //New tiddler saved
                    //Get the revision of the previous tiddler in the list so this tiddler can
                    //be displayed after it
                    var previousTiddlerRevision = -1;
                    $.each(mySPA.tiddlers, function( index, value ) {
                        if (value.title === data.title && value.bag.name === data.bag.name) {
                            if (index > 0) {
                                previousTiddlerRevision = mySPA.tiddlers[index -1].revision;                                
                            }
                            return false;
                        }
                    });
                    if (previousTiddlerRevision !== -1) {
                        //Insert after previous tiddler
                        $(card_html).insertAfter('#card_' + previousTiddlerRevision); 
                    } else {
                        //Insert as first card
                        $('#cards').prepend(card_html); 
                    }

                    setClearFixes();

                    updateTypeahead();

                }                
            }

            if (direction === 'next' || direction === 'prev') {
                $('#modalCarousel').carousel(direction);                
            }
        }
    }

    function getTiddlerDetailForEditSuccessCallback(data, flags) {
        var activeSlide = $('#modalCarousel .carousel-inner .item.active');
            editArea = $('.modal-dialog .modal-content .modal-body', activeSlide),
            tagsText = '';

        if (data.type === 'text/html') {
            
            var iFrameHeight = $('iframe', editArea).css('height').replace('px','');

            editArea.html('<textarea class="form-control" rows="15"></textarea>');

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
            if (!isCreatingNewTiddler()) {
                //Set focus to the existing tiddler content
                $('textarea', editArea).sceditor('instance').focus();
            }
        } else {
            editArea.html('<textarea class="form-control" rows="15"></textarea>');
            $('textarea', editArea).val(data.text).focus();
        }

        $('.edit-button', activeSlide).toggleClass('edit-control-display-toggle');
        $('.save-button', activeSlide).toggleClass('edit-control-display-toggle');

        if (!data.revision) {
            //New tidder, so allow editing of the title
            $('.title-header', activeSlide).toggleClass('edit-control-display-toggle');
            $('.title-edit', activeSlide).toggleClass('edit-control-display-toggle');
            $('.modal-dialog .modal-content .modal-header input', activeSlide).focus().select();

            //And also all them to set the privacy
            $('.modal-dialog .modal-content .modal-footer .private .privacy', activeSlide).toggleClass('edit-control-display-toggle');
            $('.modal-dialog .modal-content .modal-footer .private .privacy-edit', activeSlide).toggleClass('edit-control-display-toggle');

        } else {
            //Check for any existing tags
            $.each(data.tags, function (index, value) {
                if (value.indexOf(' ') !== -1) {
                    tagsText = tagsText.concat('[[').concat(value).concat(']]').concat(' ');
                } else {
                    tagsText = tagsText.concat(value).concat(' ');
                }
            });
            if (tagsText !== '') {
                //Strip the last space
                tagsText = tagsText.replace(/ $/, '');
            }
            $('.tags-edit', activeSlide).val(tagsText);
        }

        $('.tags', activeSlide).toggleClass('edit-control-display-toggle');
        $('.tags-edit', activeSlide).toggleClass('edit-control-display-toggle');


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

                        setClearFixes();

                    });                

                    updateTypeahead();

                    if (currentModalTiddlerIndex != -1 && !isCreatingNewTiddler()) {
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

    function privacyChangedSuccessCallback(data, previousTiddlerRevision) {

        //replace the old tiddler in the tiddler array
        mySPA.updateTiddlerInResultSet(previousTiddlerRevision, data);

        $('#card_' + previousTiddlerRevision).replaceWith(renderCard(data));

    }

    function getTiddlerDetailErrorCallback(error) {
        showAlert('alert-danger', 'Error retrieving data: ' + error);
        logToConsole('Error retrieving data: ' + error);
    }
    
    function retrievalErrorCallback(error) {
        showAlert('alert-danger', 'Error retrieving data: ' + error);
        logToConsole('Error retrieving data: ' + error);
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
            windowHeight,
            nextSlideToShow;

        if (slideDetail !== null && direction !== null && direction !== 'saved') {
            outgoingSlideDetail = slideDetail;
        }

        slideDetail = data;        

        if (direction === null || direction === 'saved' || direction === 'add') {
            slideData = {
                slide1: data,
                slide2: outgoingSlideDetail
            };
            nextSlideToShow = '.item.active';
        } else {
            slideData = {
                slide1: outgoingSlideDetail,
                slide2: data
            };
            if ($('#slide1').is(":visible")) {
                nextSlideToShow = '#slide2';
            } else if ($('#slide2').is(":visible")) {
                nextSlideToShow = '#slide1';
            } else {
                 nextSlideToShow = '#slide2';
            }
        }

        $(nextSlideToShow).html(slideTemplate(data));

        var showCarouselControls = (!isCreatingNewTiddler()) || direction === null;

        if (!showCarouselControls || direction === 'add') {            
            $('.carousel-control').hide();
        } else {
            $('.carousel-control').show();
        }

        var iFrame;

        if (data.type === 'text/html') {
                        
            iFrame = '#iframeid';
            $(nextSlideToShow + ' iframe').attr('id', 'iframeid');            
            document.getElementById('iframeid').contentWindow.document.write(data.text); 
            
            var head = $(iFrame).contents().find("head");                
            head.append($("<link/>", 
                { rel: "stylesheet", href: "bootstrap.min.css", type: "text/css" }));

        }
        

        pageHeight = $(window).height();

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
            $(nextSlideToShow + ' iframe').removeAttr('id');
        }

        if (data.bag && /_private$/.test(data.bag.name)) {
            $(nextSlideToShow + ' .private i').removeClass('fa fa-unlock-alt fa-2x').addClass('fa fa-lock fa-2x').attr("title", "Private");
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

    function renderCard(data) {
        var card_html,
            card_dom;

        card_html = cardTemplate(data);

        //Set the privacy icon       
        if (data.bag && /_private$/.test(data.bag.name)) {
            card_dom = $('<div/>').html(card_html);
            $('.privacy i', card_dom).removeClass('fa fa-unlock-alt fa-2x').addClass('fa fa-lock fa-2x').attr("title", "Private");
            card_html = card_dom.html();
        }
        return card_html;
    }

    function updateTypeahead() {
        //Empty the tiddler titles array, but keeping the same reference so that the typeahead control is updated
        tiddlerTitles.length = 0;
        
        $.each(mySPA.tiddlers, function( index, tiddler ) {
            tiddlerTitles.push({title:tiddler.title, id:tiddler.revision});
        });    
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
        var tiddler = new tiddlyweb.Tiddler('New Tiddler');
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
        if ($('[data-toggle=expand] i').hasClass('fa-expand')) {
            $('.card .panel-heading i.expand-toggle').removeClass('fa fa-chevron-up fa-2x').addClass('fa fa-chevron-down fa-2x');
            $('.card .panel-body').closest('div').removeClass('expand');
        } else {
            $('.card .panel-heading .expand-toggle').trigger('click');
            $('.card .panel-heading i.expand-toggle').removeClass('fa fa-chevron-down fa-2x').addClass('fa fa-chevron-up fa-2x');
            $('.card .panel-body').closest('div').addClass('expand');
        }
    }

    function changePrivacyIcon() {
        var privacyIcon = $('#modalCarousel .carousel-inner .item.active .modal-dialog .modal-content .modal-footer .private .privacy-edit i');

        if (privacyIcon.hasClass('fa fa-unlock-alt fa-2x')) {
            privacyIcon.removeClass('fa fa-unlock-alt fa-2x').addClass('fa fa-lock fa-2x').attr("title", "Change to Public");
        } else {
            privacyIcon.removeClass('fa fa-lock fa-2x').addClass('fa fa-unlock-alt fa-2x').attr("title", "Change to Private");
        }
    }

    function showAlert(alertType, alertText) {
        var alertContainer = $('div.alert-offcanvas'),
            exisingTop = alertContainer.css('top');
  
        $('div.alert', alertContainer).addClass(alertType).html(alertText).parent().fadeIn(500).delay(1000).animate(
            {'top':'-=100px', 'opacity':'0'},
            '2000', function() {                            
                alertContainer.css({ 'top': exisingTop, 'opacity': '1', 'display': 'none' });
                $('div.alert', this).removeClass(alertType);
            }
        );
        
    }
    
    function scrollToID(id, speed){
        var offSet = 40,
            scrollToObject = $(id),
            currentObjLocation = (scrollToObject.offset().top - offSet),
            currentScrollLocation = $('#main').scrollTop(),
            targetOffset = currentScrollLocation + currentObjLocation;
        
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
                $(matchedCardIds).show();
            } else {
                //No match so hide them all
                $('.card').hide();
            }
        } else {
            //No ids passed in, so show them all
            $('.card').show();
        }

        setClearFixes();

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
                sidebarright.addClass('sidebar-right-scrollbar-visible-toggle').removeClass('sidebar-right-scrollbar-not-visible-toggle');                                      
            };
        } else {
            var sidebarright = $('#sidebar-right');
            if (!(sidebarright).hasClass('sidebar-right-scrollbar-not-visible-toggle')) {
                sidebarright.addClass('sidebar-right-scrollbar-not-visible-toggle').removeClass('sidebar-right-scrollbar-visible-toggle');
            }                
        };
    }

    function setClearFixes() {
        $('.cardclearfix').remove();
        $('.card').filter(':visible').each(function( index, card) {
            if (index % 3 === 0) {                
                $( card ).before('<div class="clearfix visible-xs-block cardclearfix"></div>');
            }
        });
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

    function isCreatingNewTiddler() {
        return !$('.carousel-control').is(":visible");
    }

    function logToConsole(string) {        
        console.log(string);        
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
            $('.sidebar-toggle i').toggleClass('fa fa-chevron-right').toggleClass('fa fa-chevron-left');
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
            $('.sidebar-right-toggle i').toggleClass('fa fa-expand').toggleClass('fa fa-compress');
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

        $( window ).resize(function() {
            checkScrollbarVisibility();
        });

        //Register a console log method for browsers which don't have a console unless in
        //debug (Internet Explorer)
        if (!window.console) window.console = {};
        if (!window.console.log) window.console.log = function () { };
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
            slideTemplateScript = $('#slideTemplate').html();
    	
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
        slideTemplate = Handlebars.compile(slideTemplateScript);

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
    
    changePrivacy: function (revision) {
        //currentModalTiddlerIndex = getTiddlerIndexFromRevision(revision);  
        //mySPA.changePrivacy(currentModalTiddlerIndex, null, privacyChangedSuccessCallback);
        changePrivacyIcon();
    },

    editTiddler: function () {
        mySPA.getTiddlerDetail(currentModalTiddlerIndex, null, getTiddlerDetailForEditSuccessCallback);
    },

    saveTiddler: function () {

        if (mySPA.getWorkingTiddler() !== null) {

            var tiddler = mySPA.getWorkingTiddler(),
                updatedTiddlerDetails = $('#modalCarousel .carousel-inner .item.active .modal-dialog .modal-content'),
                tagsRegEx = /((\[\[.*?\]\])|[\S]*)+/g,
                tags = $('.modal-footer .tags-edit', updatedTiddlerDetails).val();

            tiddler.title = $('.modal-header .title-edit', updatedTiddlerDetails).val();
            
            if (!tiddler.revision) {
                //A new tiddler, so set it's bag
                if ($('.modal-footer .private .privacy-edit i', updatedTiddlerDetails).hasClass('fa fa-unlock-alt fa-2x')) {
                    //Tiddler should be public
                    tiddler.bag = new tiddlyweb.Bag(mySPA.space + '_public', mySPA.host)
                } else {
                    //Tiddler should be private
                    tiddler.bag = new tiddlyweb.Bag(mySPA.space + '_private', mySPA.host)
                }     
            }

            tiddler.tags = [];
            $.each(tags.match(tagsRegEx), function(index, value) {
                if (value !== '') {
                    if (/^\[\[.*\]\]$/.test(value)) {
                        tiddler.tags.push(value.replace(/^\[\[/, '').replace(/\]\]$/, ''));
                    } else {
                        tiddler.tags.push(value);
                    }
                }
            });

            if (tiddler.type !== 'text/html') {
                tiddler.text = $('.modal-body textarea', updatedTiddlerDetails).val();
            } else {
                tiddler.text = $('.modal-body textarea', updatedTiddlerDetails).sceditor('instance').val();
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
            $('#modalCarousel .carousel-inner .item.active .edit-button').toggleClass('edit-control-display-toggle');
            $('#modalCarousel .carousel-inner .item.active .save-button').toggleClass('edit-control-display-toggle');
            $('#tiddlerModal').modal('hide');
        }
    }

  };
})();

(function() {
    tmanager.init();
})();



