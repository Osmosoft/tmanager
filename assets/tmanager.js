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
            hashCode;

        this.tsStore.save(tiddler, function(response, error){
            if (response) {                
                showAlert('alert-success', 'The tiddler has been saved.');
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
    };

    SPA.prototype.getWorkingTiddler = function() {
        return this.workingTiddler;
    };

    SPA.prototype.setWorkingTiddler = function(tiddler) {
        this.workingTiddler = tiddler;
    };

    SPA.prototype.updateTiddlerInResultSet = function(tiddlerToReplaceHash, newTiddler) {
        var indexPos = -1;
        $.each(this.tiddlers, function (index, tiddler) {
            if (tiddler.fields._hash === tiddlerToReplaceHash) {
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
            tiddlerTitles.push(this.title);
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
    }
    
    function getTiddlerDetailSuccessCallback(data, direction) {

        var workingTiddlerHash = null; 

        if (mySPA.getWorkingTiddler() !== null) {
            workingTiddlerHash = mySPA.getWorkingTiddler().fields._hash;
        }

        mySPA.setWorkingTiddler(null);

        renderTiddlerDetail(data, direction);

        if (direction !== null) {
            if (direction === 'deleted') {
                direction = 'next';                
            } else if (direction === 'saved') {
                //update the tiddler in the main page body
                hashCode = data.fields._hash;
                card_html =  $(cardTemplate(data));
                
                if ($('#tiddler-content-' + workingTiddlerHash).html() !== '') {

                    if (data.type === 'image/svg+xml') {
                        $('#tiddler-content-' + hashCode, card_html).html(data.text);
                    } else if (data.type === 'image/png' || data.type === 'image/jpeg') {
                        $('#tiddler-content-' + hashCode, card_html).html('<img src="' + data.uri + '"/>');
                    } else if (data.render) {
                        //card_html.find('#tiddler-content-' + hashCode).html(data.render);
                        $('#tiddler-content-' + hashCode, card_html).html(data.render);
                    } else {
                        $('#tiddler-content-' + hashCode, card_html).html('<pre>' + htmlEncode(data.text) + '</pre>');
                    }
                }

                if ($('#card_' + workingTiddlerHash + ' .panel .panel-body').hasClass('expand')) {                    
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

                $('#card_' + workingTiddlerHash).replaceWith(card_html);  

                //replace the old tiddler in the tiddler array
                mySPA.updateTiddlerInResultSet(workingTiddlerHash, data);
            }

            if (direction === 'next' || direction === 'prev') {
                $('#modalCarousel').carousel(direction);    
            }

        }
    }

    function getTiddlerDetailForEditSuccessCallback(data, flags) {
        var editArea = $('#modalCarousel .carousel-inner .item.active .modal-dialog .modal-content .modal-body');

        editArea.html('<textarea class="form-control" rows="15"></textarea>');
        $('textarea', editArea).val(data.text);

        $('#modalCarousel .carousel-inner .item.active .edit-button').toggleClass('button-display-toggle');
        $('#modalCarousel .carousel-inner .item.active .save-button').toggleClass('button-display-toggle');

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
                showAlert('alert-success', 'The tiddler has been deleted.');
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
     function closePresetModalAndUpdatePresets() {        
        $('#savePresetModal').modal('hide');
        updatePresets();

        $('#presetItems').val($('#spPresetName').val());
        updateSearchForm();
     }
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
    function resetSearchForm() {
        $('#presetItems')[0].selectedIndex = 0;        
        $('#sidebar-form input').val('');        
    }
 
    function renderTiddlerDetail(data, direction) {

        var slideData,
            pageHeight,
            windowHeight;
        
        
        console.log(data);

        if (slideDetail !== null && direction !== null && direction !== 'saved') {
            outgoingSlideDetail = slideDetail;
        }

        slideDetail = data;        

        if (direction === null || direction === 'saved') {
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
        //windowHeight = Math.floor(pageHeight * 0.9);

        $('.carousel-control.left').click(function () {
            slideCard('prev');
        });
        $('.carousel-control.right').click(function () {
            slideCard('next');       
        });


        $('#tiddlerModal .modal-content').css({
            'max-height': (Math.floor(pageHeight * 0.9)) + 'px'
        });

        $('#tiddlerModal .modal-body').css({
            'max-height': (Math.floor(pageHeight * 0.5)) + 'px'
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
        var saveName = $('#spPresetName').val().trim(),
            existingPreset = false,
            newPreset;
    
        if ($('#presetSaveForm').data('bootstrapValidator').validate().isValid()) {

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

            mySPA.saveConfiguration(configuration, closePresetModalAndUpdatePresets);

        } else {
            console.log('xxx');
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

        console.log(currentObjLocation);
        console.log(targetOffset);
        console.log(currentScrollLocation);
        
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
                divID = '#card_' + tiddler.fields._hash;
                console.log(tiddler.title);
                return false;
            }
        });

        if (divID != null) {
            scrollToID(divID, 2000);
        }
    }

    function substringMatcher(strs) {
      return function findMatches(q, cb) {
        var matches, substrRegex;
     
        // an array that will be populated with substring matches
        matches = [];
     
        // regex used to determine if a string contains the substring `q`
        substrRegex = new RegExp(q, 'i');
     
        // iterate through the pool of strings and for any string that
        // contains the substring `q`, add it to the `matches` array
        $.each(strs, function(i, str) {
          if (substrRegex.test(str)) {
            // the typeahead jQuery plugin expects suggestions to a
            // JavaScript object, refer to typeahead docs for more info
            matches.push({ value: str });
          }
        });
     
        cb(matches);
      };
    };

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
            $('.alert-offcanvas').toggleClass('active');
            console.log($('.alert-offcanvas'));
            $('.sidebar-toggle i').toggleClass('fa fa-chevron-right');
            $('.sidebar-toggle i').toggleClass('fa fa-chevron-left');
        });

        //The scrollTo entry box

        $('#scrollTo').typeahead({
            hint: true,
            highlight: true,
            minLength: 1
        },
        {
            name: 'tiddlerTitles',
            displayKey: 'value',
            source: substringMatcher(tiddlerTitles)
        });

        $('#scrollTo').bind('typeahead:selected', function(obj, datum, name) {            
            scrollToCard(datum.value, true);
            $('#scrollTo').typeahead('close');
        });

        $('#scrollTo').keypress(function (e) {
            if (e.which == 13) {
                scrollToCard($('#scrollTo').val(), false);                
            }
            $('#scrollTo').typeahead('close');
        });

        $('.twitter-typeahead').css('vertical-align', 'middle');
    
        //Configure the data toggle for the expand/collapse all button
        $('[data-toggle=expand]').click(function () {
            $('.sidebar-right-toggle i').toggleClass('fa fa-expand');
            $('.sidebar-right-toggle i').toggleClass('fa fa-compress');
            expandCollapseAll();
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
        // else if ($('#card_' + hashCode + ' .panel .panel-body').hasClass('expand') === false) {
        //    $('#card_' + hashCode + ' .panel .panel-body').addClass('expand');
        //}
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



