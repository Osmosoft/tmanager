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
        this.tsStore = tiddlyweb.Store(null, false),
        this.tiddlers = [],
        this.workingTiddler = '',
        this.workingTiddlerIndex = -1,
        this.configurationTiddler = '';
    }

    SPA.prototype.getInitialTiddlers = function (tiddlySpace, successCallback, errorCallback) {
        console.log('Getting initial tiddlers from host ' + this.host);

        var spa = this;

        this.tsStore = tiddlyweb.Store(function () {

            var excludeQuery = ' !#excludeLists !#excludeSearch';

            spa.tiddlers = spa.tsStore(excludeQuery).unique().sort('title');

            successCallback();

            console.log('Number of tiddlers returned = ' + spa.tiddlers.length);

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

        var spa = this;

        this.tsStore.save(tiddler, function(response, error){
            
            if (response) {
                console.log('Saved tiddler');                
                spa.getTiddlerDetail(workingTiddlerIndex, null, successCallback);
            } else if (error.name === 'SaveError') {
                console.log('There was a problem saving. Please try again');
            } else if (error.name === 'EmptyError') {
                console.log('There is nothing to save');
            }
            
        });
    };

    SPA.prototype.saveConfiguration = function(configuration, successCallback) {

        var spa = this;

        this.configurationTiddler.text = JSON.stringify(configuration);

        this.tsStore.save(this.configurationTiddler, function(response, error){
            
            if (response) {
                console.log('Saved tiddler');
                spa.configurationTiddler = response;
                successCallback();
            } else if (error.name === 'SaveError') {
                console.log('There was a problem saving. Please try again');
            } else if (error.name === 'EmptyError') {
                console.log('There is nothing to save');
            }
            
        });
    };

    SPA.prototype.deleteTiddler = function(tiddlerIndex, successCallback) {    
        var spa = this;
        console.log('Deleting tiddler');
        console.log(this.tiddlers[tiddlerIndex]);

        successCallback();

        this.tsStore.destroy(this.tiddlers[tiddlerIndex], function(response, error){
            if (response) {
                successCallback();
            } else if (error.name === 'RemoveError') {
                console.log('There was a problem deleting. Please try again');
            } else if (error.name === 'EmptyError') {
                console.log('There is nothing to delete');
            }
        });
    };

    SPA.prototype.getWorkingTiddler = function() {
        return this.workingTiddler;
    };

    SPA.prototype.setWorkingTiddler = function(tiddler) {
        this.workingTiddler = tiddler;
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
        configuration;    

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
            configurationExists = false;

        $.each(mySPA.tiddlers, function (index) {
            if (this.title === configurationTiddlerName) {
                configurationExists = true;
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
            });
            mySPA.tsStore.add(configTiddler, true);
            mySPA.tsStore.save(configTiddler, function(tiddler) {
                mySPA.configurationTiddler = tiddler;
                updatePresets();
                renderTiddlersAsCardsCallback(mySPA.tiddlers);
            });
        }
    }
    
    function renderTiddlersAsCardsCallback(tiddlers) {
        var col_1_html = '<div class="col-md-4">',
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

        //$("#cards").html('<ul class="list-unstyled">'  + cards_html + '</ul>');
        $('#cards').html(cards_html);

        //Add the toggle to the new cards for the expand/collapse chevron
        $('[data-toggle=expand-panel]').click(function () {
            $('i', this).toggleClass('fa fa-chevron-up fa-2x');
            $('i', this).toggleClass('fa fa-chevron-down fa-2x');
            $('.panel-body', $(this).parent().parent().parent()).toggleClass('expand');
        });

    }
    
    function getTiddlerDetailSuccessCallback(data, direction) {

        mySPA.setWorkingTiddler(null);

        renderTiddlerDetail(data, direction);

        if (direction !== null) {
            if (direction === 'deleted') {
                direction = 'next';
            }
            $('#modalCarousel').carousel(direction);
        }

    }

    function getTiddlerDetailForEditSuccessCallback(data, flags) {
        var editArea = $('#modalCarousel .carousel-inner .item.active .modal-dialog .modal-content .modal-body');

        editArea.html('<textarea class="form-control" rows="15"></textarea>');
        $('textarea', editArea).val(data.text);

        mySPA.setWorkingTiddler(data);
    }

    function deleteTiddlerSuccessCallback() {
        console.log('Tiddler deleted succesfully.');

        $('#modalCarousel .carousel-inner .item.active .modal-dialog .modal-content').fadeOut('fast').queue(            
            function() {

                //Update the main page to reflect the tiddler has been removed
                removedTiddlerHash = mySPA.tiddlers[currentModalTiddlerIndex].fields._hash;
                $('#card_' + removedTiddlerHash ).remove();
                $('.cardclearfix').remove();

                $('.card').each(function( index, card){
                    if (index % 3 === 0) {                
                        $( card ).before('<div class="clearfix visible-xs-block cardclearfix"></div>');
                    }
                });

                if (currentModalTiddlerIndex === mySPA.tiddlers.length - 1) {
                    mySPA.tiddlers.splice(currentModalTiddlerIndex, 1);
                    currentModalTiddlerIndex = 0;
                } else {
                    mySPA.tiddlers.splice(currentModalTiddlerIndex, 1);
                }            

                if (mySPA.tiddlers.length > 0) {
                    mySPA.getTiddlerDetail(currentModalTiddlerIndex, 'deleted', getTiddlerDetailSuccessCallback);
                } else {
                    $('#tiddlerModal').modal('hide');
                }

            }
        );        
    }

    function getTiddlerDetailErrorCallback(error) {
        console.log('Error retrieving data: ' + error);
    }
    
    function retrievalErrorCallback(error) {
        console.log('Error retrieving data: ' + error);
    }
    
    /*
     * End of callback functions
     */
    

    /*
     * Private functions
     */
    function updatePresets() {
        console.log(mySPA.configurationTiddler);
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
 
    function renderTiddlerDetail(data, direction) {

    	var slideData,
            pageHeight,
            windowHeight;
    	
    	
        console.log(data);

        if (slideDetail !== null && direction !== null) {
            outgoingSlideDetail = slideDetail;
        }

        slideDetail = data;        

        if (direction === null) {
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

        $('#tiddlerModal').html(tiddlerModalTemplate(slideData));

        pageHeight = $(window).height();
        windowHeight = Math.floor(pageHeight * 0.5);

        $('.carousel-control.left').click(function () {
            slideCard('prev');
        });
        $('.carousel-control.right').click(function () {
            slideCard('next');       
        });


        $('#tiddlerModal .modal-body').css({
            'max-height': windowHeight + 'px'
        });

        if (direction === 'deleted') {
            //$('#modalCarousel').find(".item.active .modal-dialog .modal-content").css('background-color', 'red');
            $('#modalCarousel').find('.item.active').addClass('deleted');
        }

        if (direction === null) {
            $('#tiddlerModal').modal('show');
        }
    }

    function getTiddlerIndexFromHash(hashCode) {    
        var tiddlerIndex = -1;
        $.each(mySPA.tiddlers, function( index, tiddler ) {
            if (hashCode === tiddler.fields._hash) {
                tiddlerIndex = index;
                return false;
            }
        });    
        return tiddlerIndex;;
    }

    function slideCard(direction) {
        if (direction === 'prev') {
            if (currentModalTiddlerIndex === 0) {
                currentModalTiddlerIndex = mySPA.tiddlers.length - 1;
            } else {
                currentModalTiddlerIndex = currentModalTiddlerIndex - 1;
            }
        } else {
            if (currentModalTiddlerIndex === mySPA.tiddlers.length - 1) {
                currentModalTiddlerIndex = 0;
            } else {
                currentModalTiddlerIndex = currentModalTiddlerIndex + 1;
            }
        }
        mySPA.getTiddlerDetail(currentModalTiddlerIndex, direction, getTiddlerDetailSuccessCallback);
    }

    function deleteTiddler() {
        mySPA.deleteTiddler(currentModalTiddlerIndex, deleteTiddlerSuccessCallback);
    }

    function savePreset() {
        var saveName = $('#spPresetName').val(),
            existingPreset = false,
            newPreset;

        $.each(configuration.presets, function(index, preset){
            console.log(preset.name + ' ' + index);
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

        mySPA.saveConfiguration(configuration, updatePresets);

        console.log(JSON.stringify(configuration.presets));
    }

    function confirmSavePreset() {    
        var options = {
            'backdrop' : 'static'
        };

        $('#spPresetName').val($('#presetItems').val());
        $('#spSpace').val($('#space').val());
        //$('#spBag').val($('#bag').val());
        $('#spTag').val($('#tag').val());
        $('#spTitle').val($('#title').val());
        $('#spAuthor').val($('#author').val());
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
            $('.sidebar-toggle i').toggleClass('fa fa-chevron-right');
            $('.sidebar-toggle i').toggleClass('fa fa-chevron-left');
        });

        //Configure the data toggle for the expand/collapse all button
        $('[data-toggle=expand]').click(function () {
            $('.sidebar-right-toggle i').toggleClass('fa fa-expand');
            $('.sidebar-right-toggle i').toggleClass('fa fa-compress');
            expandCollapseAll();
        });

        $('#btnDeleteTiddler').click(function() {            
            deleteTiddler();
        });

        $('#btnSavePreset').click(function() {
            savePreset();
        });

        //Attach the save preset function
        $('#save-preset').click(function () {
            confirmSavePreset();
        });

        $('#presetItems').on('change', function () {
            updateSearchForm();
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
    },
    
    getCardBody: function (hashCode) {    
        if ($('#tiddler-content-' + hashCode).html() === '') {
            
        	var tiddlerIndex = getTiddlerIndexFromHash(hashCode),  
                tiddler = mySPA.tiddlers[tiddlerIndex];
            
            console.log(tiddler.title);
            mySPA.tsStore.get(tiddler, function (tiddler) {
                console.log(tiddler);
                if (tiddler.type === 'image/svg+xml') {
                    $('#tiddler-content-' + hashCode).html(tiddler.text);
                } else if (tiddler.type === 'image/png' || tiddler.type === 'image/jpeg') {
                    $('#tiddler-content-' + hashCode).html('<img src="' + tiddler.uri + '"/>');
                } else if (tiddler.render) {
                    $('#tiddler-content-' + hashCode).html(tiddler.render);
                } else {
                    $('#tiddler-content-' + hashCode).html('<pre>' + htmlEncode(tiddler.text) + '</pre>');
                }
            }, true);
        }
    },
    
    showModalCarousel: function (hashCode) {
        currentModalTiddlerIndex = getTiddlerIndexFromHash(hashCode);  
        mySPA.getTiddlerDetail(currentModalTiddlerIndex, null, getTiddlerDetailSuccessCallback);
    },
    
    editTiddler: function () {
        mySPA.getTiddlerDetail(currentModalTiddlerIndex, null, getTiddlerDetailForEditSuccessCallback);
    },

    saveTiddler: function () {

        if (mySPA.getWorkingTiddler() !== null) {

            var tiddler = mySPA.getWorkingTiddler();

            tiddler.text = $('#modalCarousel .carousel-inner .item.active .modal-dialog .modal-content .modal-body textarea').val();

            mySPA.setWorkingTiddler(tiddler);

            mySPA.saveTiddler(tiddler, currentModalTiddlerIndex, getTiddlerDetailSuccessCallback);

        }
    },
    
    confirmDeleteTiddler: function () {    
        var options = {
            'backdrop' : 'static'
        };

        $('#deleteConfirmModal .modal-dialog .modal-content .modal-body .tiddlerName').html('<h2>' + mySPA.tiddlers[currentModalTiddlerIndex].title + '</h2>');

        $('#deleteConfirmModal').modal(options);
    },
   
  };
})();

(function() {
    tmanager.init();
})();



