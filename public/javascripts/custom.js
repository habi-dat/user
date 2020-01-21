  $(document).ready(function(){
    var table = $('.datatable').dataTable( {
        "info":           false,
        "paging":         false,
        "oLanguage": {
          "sSearch": "Suche: "
        }
    } );

    $('#cn').keyup((event) => {
        $('#changedUid').val($('#cn').val().toLowerCase()
              .replace('ä', 'ae')
              .replace('ö', 'oe')
              .replace('ü', 'ue')
              .replace('ß', 'ss')
              .replace(' ', '_')
              .replace(/[\W]+/g,"")
              .substr(0,35));
    })

    $('[data-toggle="tooltip"]').tooltip();

    $('#usertable tbody').on( 'click', 'tr', function () {
    if ( $(this).hasClass('selected') ) {
        $(this).removeClass('selected');
        $('#grouptable tbody tr').removeClass('hidden');
        $('#grouptable tbody tr td:first-child .priv-icon').remove();
    }
    else {
        $('#usertable tbody tr.selected').removeClass('selected');
        $(this).addClass('selected');
        var dn = $(this).find('.dn').text();
        $('#grouptable tbody tr').addClass('hidden');
        $('#grouptable tbody tr td:first-child .priv-icon').remove();
        $('#grouptable tbody tr td .admindn').each(function() {
          if ($(this).text() == dn) {
            $(this).parent().parent().removeClass('hidden');
            $(this).parent().parent().children().first().prepend('<span class="priv-icon glyphicon glyphicon-edit" style="color:green;"></span>');            
          }
        });
        $('#grouptable tbody tr td .memberdn').each(function() {
          if ($(this).parent().parent().hasClass('hidden') && $(this).text() == dn) {
            $(this).parent().parent().removeClass('hidden');
            $(this).parent().parent().children().first().prepend('<span class="priv-icon glyphicon glyphicon-check" style="color:blue;"></span>');            
          }
        });        
    }
    } );
    $('#grouptable tbody').on( 'click', 'tr', function () {
    if ( $(this).hasClass('selected') ) {
        $(this).removeClass('selected');
        $('#usertable tbody tr').removeClass('hidden');
        $('#usertable tbody tr td:first-child .priv-icon').remove();        
    }
    else {
        $('#grouptable tbody tr.selected').removeClass('selected');
        $(this).addClass('selected');
        $('#usertable tbody tr').addClass('hidden');
        $('#usertable tbody tr td:first-child .priv-icon').remove();
        $(this).find('.admindn').each(function() {
          var dn = $(this).text();
          $('#usertable tbody tr .dn').each(function() {
            if($(this).text() == dn) {
              $(this).parent().removeClass('hidden');
              $(this).parent().children().first().prepend('<span class="priv-icon glyphicon glyphicon-edit" style="color:green;"></span>');
            }
          });
        });
        $(this).find('.memberdn').each(function() {
          var dn = $(this).text();
          $('#usertable tbody tr .dn').each(function() {
            if($(this).parent().hasClass('hidden') && $(this).text() == dn) {
              $(this).parent().removeClass('hidden');
              $(this).parent().children().first().prepend('<span class="priv-icon glyphicon glyphicon-check" style="color:blue;"></span>');
            }
          });
        });        
    }
    } );

    $('#grouptable_cat tbody').on( 'click', 'tr', function () {
    if ( $(this).hasClass('selected') ) {
        $(this).removeClass('selected');
        $('#catable tbody tr').removeClass('hidden');
    }
    else {
        $('#grouptable_cat tbody tr.selected').removeClass('selected');
        $(this).addClass('selected');
        var cn = $(this).find('.groupcn').text();
        $('#cattable tbody tr').addClass('hidden');
        $('#cattable tbody tr td .groupname').each(function() {
          if ($(this).text() == cn) {
            $(this).parent().parent().removeClass('hidden');
          }
        });
    }
    } );


    var cat_table = $('#cattable').dataTable( {
        "info":           false,
        "paging":         false,
        "order": [],
        "oLanguage": {
          "sSearch": "Suche: "
        }
    });

    $('#cattable tbody').on('click', 'span.subcategories-button', function () {
        var tr = $(this).closest('tr').next('tr');
        if (tr.hasClass('hidden')) {
            $(this).removeClass('glyphicon-plus').addClass('glyphicon-minus');
        } else {
            $(this).removeClass('glyphicon-minus').addClass('glyphicon-plus');
        }

        var switchRow = function(tableRow) {
            if (tableRow.hasClass('sub-category')) {
                if (tableRow.hasClass('hidden')) {
                    tableRow.removeClass('hidden');
                } else {
                    tableRow.addClass('hidden');
                }
                switchRow(tableRow.next('tr'));
            } else {
                return;
            }
        };

        switchRow(tr);
    } );

    $('#cattable tbody').on( 'click', 'tr', function () {
    if ( $(this).hasClass('selected') ) {
        $(this).removeClass('selected');
        $('#grouptable_cat tbody tr').removeClass('hidden');
    }
    else {
        $('#cattable tbody tr.selected').removeClass('selected');
        $(this).addClass('selected');
        $('#grouptable_cat tbody tr').addClass('hidden');
        $(this).find('.groupname').each(function() {
          var cn = $(this).text();
          $('#grouptable_cat tbody tr .groupcn').each(function() {
            if($(this).text() == cn) {
              $(this).parent().removeClass('hidden');
            }
          });
        });
    }
    } );
  });

  $(document).ready(function () {

    $('#cn').change((event) => {
        var url = '/user/available/cn/' + $('#cn').val()
        var token = $('#cn').attr('token');
        if (token) {
            url += '/' + token;
        }
        $.getJSON(url, (response) => {
            if (!response.available) {
                $('#cn').attr('available', false);
                $('#cn').parent('.input-group').after('<span class="help-block" id="helpCNAvailable" style="color:red;">Der Name ist leider schon vergeben</span>');
            } else {
                $('#cn').attr('available', true);
                $("#helpCNAvailable").remove();
            }
        })

        var url = '/user/available/uid/' + $('#changedUid').val()
        var token = $('#changedUid').attr('token');
        if (token) {
            url += '/' + token;
        }
        $.getJSON(url, (response) => {
            if (!response.available) {
                $('#changedUid').attr('available', false);
                $('#changedUid').parent('.input-group').after('<span class="help-block" id="helpUidAvailable" style="color:red;">Die User ID ist leider schon vergeben</span>');
            } else {
                $('#changedUid').attr('available', true);
                $("#helpUidAvailable").remove();
            }
        })        
    })

    $('#changedUid').change((event) => {
        var url = '/user/available/uid/' + $('#changedUid').val()
        var token = $('#changedUid').attr('token');
        if (token) {
            url += '/' + token;
        }
        $.getJSON(url, (response) => {
            if (!response.available) {
                $('#changedUid').attr('available', false);
                $('#changedUid').parent('.input-group').after('<span class="help-block" id="helpUidAvailable" style="color:red;">Die User ID ist leider schon vergeben</span>');
            } else {
                $('#changedUid').attr('available', true);
                $("#helpUidAvailable").remove();
            }
        })
    })


    $('.redirect').each(function() {
        var url = $(this).attr('redirect-url');
        setTimeout(function(){ window.location = url}, 3000);
    });

    var isAdmin = $('.list-user-groups').attr('is-admin');

    $('.list-user-groups.checked-list-box .list-group-item').each(function () {

        // Settings
        var $widget = $(this),
            $checkbox = $('<input type="checkbox" class="hidden" name="'+$widget.prop('id')+'"/>'),
            color = ($widget.data('color') ? $widget.data('color') : "primary"),
            style = "btn-"; // ($widget.data('style') == "button" ? "btn-" : "list-group-item-"),
            settings = {
                on: {
                    icon: 'glyphicon glyphicon-check'
                },
                off: {
                    icon: 'glyphicon glyphicon-unchecked'
                },
                admin: {
                    icon: 'glyphicon glyphicon-edit '
                }
            };

        if ($widget.hasClass('admin')) {
            $widget.data('state', 'admin');
        }
        else if ($widget.hasClass('active')) {
            $widget.data('state', 'on');
        } else {
            $widget.data('state', 'off');
        }
        $widget.css('cursor', 'pointer');
        $widget.append($checkbox);

        // Event Handlers
        $widget.on('click', function () {
            var $state = $widget.data('state');
            //$checkbox.prop('checked', !$checkbox.is(':checked'));
            //$checkbox.triggerHandler('change');
            if ($state == "on") {
                if (isAdmin) {
                    $widget.data('state', 'admin');    
                } else {
                    $widget.data('state', 'off');                        
                }
                
            } else if ($state == "admin") {
                $widget.data('state', 'off');
            } else {
                $widget.data('state', 'on');
            }
            updateDisplay();
        });
        $checkbox.on('change', function () {
            updateDisplay();
        });


        // Actions
        function updateDisplay() {
            var $state = $widget.data('state');

            // Set the button's state
            if ($state == "admin") {
                $widget.removeClass(style + 'primary active');
                $widget.addClass(style + 'success active admin');
            } else if ($state == "on") {
                $widget.addClass(style + 'primary active');
            } else {
                $widget.removeClass(style + 'success ' + style + 'primary active admin');
            }
            // Set the button's icon
            $widget.find('.state-icon')
                .removeClass()
                .addClass('state-icon ' + settings[$widget.data('state')].icon);

        }

        // Initialization
        function init() {


            updateDisplay();

            // Inject the icon if applicable
            if ($widget.find('.state-icon').length == 0) {
                $widget.prepend('<span class="state-icon ' + settings[$widget.data('state')].icon + '"></span>');
            }
        }
        init();
    });

    $('.list-cat-groups.checked-list-box .list-group-item').each(function () {

        // Settings
        var $widget = $(this),
            $checkbox = $('<input type="checkbox" class="hidden" name="'+$widget.prop('id')+'"/>'),
            color = ($widget.data('color') ? $widget.data('color') : "primary"),
            style = "btn-"; // ($widget.data('style') == "button" ? "btn-" : "list-group-item-"),
            settings = {
                on: {
                    icon: 'glyphicon glyphicon-check'
                },
                off: {
                    icon: 'glyphicon glyphicon-unchecked'
                }
            };

        if ($widget.hasClass('active')) {
            $widget.data('state', 'on');
        } else {
            $widget.data('state', 'off');
        }
        $widget.css('cursor', 'pointer');
        $widget.append($checkbox);

        // Event Handlers
        $widget.on('click', function () {
            var $state = $widget.data('state');
            //$checkbox.prop('checked', !$checkbox.is(':checked'));
            //$checkbox.triggerHandler('change');
            if ($state == "on") {
                $widget.data('state', 'off');
            } else {
                $widget.data('state', 'on');
            }
            updateDisplay();
        });
        $checkbox.on('change', function () {
            updateDisplay();
        });


        // Actions
        function updateDisplay() {
            var $state = $widget.data('state');

            // Set the button's state
            if ($state == "on") {
                $widget.addClass(style + 'primary active');
            } else {
                $widget.removeClass(style + 'primary active');
            }
            // Set the button's icon
            $widget.find('.state-icon')
                .removeClass()
                .addClass('state-icon ' + settings[$widget.data('state')].icon);

        }

        // Initialization
        function init() {


            updateDisplay();

            // Inject the icon if applicable
            if ($widget.find('.state-icon').length == 0) {
                $widget.prepend('<span class="state-icon ' + settings[$widget.data('state')].icon + '"></span>');
            }
        }
        init();
    });


    //colorpicker

    $('.colorpicker-input').colorpicker({
            customClass: 'colorpicker-2x',
            align: 'left',
            sliders: {
                saturation: {
                    maxLeft: 200,
                    maxTop: 200
                },
                hue: {
                    maxTop: 200
                },
                alpha: {
                    maxTop: 200
                }
            }
        });



    $('#activation_checkbox').click(function() {
        $('#password_fields').toggle(1);
    });

    $('#deleteimage_checkbox').click(function() {
        $('#cat_image_upload').toggle(1);
    });

    $('.checkbox-form').submit(function(event) {
        var $hidden = $("<input type='hidden' class='hidden-groups' name='member'/>");
        var $hiddenAdmin = $("<input type='hidden' class='hidden-groups' name='owner'/>");
        var isAdmin = $(this).attr('is-admin');
        //event.preventDefault();
        var checkedItems = [], counter = 0;
        $("#check-list-box li.active").each(function(idx, li) {
            checkedItems.push($(li).prop('id'));
            counter++;
        });
        $hidden.val(JSON.stringify(checkedItems));
        var adminItems = [];
        if (isAdmin) {
            $("#check-list-box li.active.admin").each(function(idx, li) {
                adminItems.push($(li).prop('id'));
            });            
        }
        $hiddenAdmin.val(JSON.stringify(adminItems));
        $(this).find('.hidden-groups').remove();
        $(this).append($hidden);
        $(this).append($hiddenAdmin);
        if ($('#cn').attr('available') == "false") {
            $('#cn').focus();
            event.preventDefault();
        } else if  ($('#changedUid').attr('available') == "false") {
            $('#changedUid').focus();
            event.preventDefault();
        }
        //return true;
    });


    $(".alert-fadeout").fadeTo(2000, 500).slideUp(500, function(){
        $(".alert-fadeout").slideUp(500);
    });

    $(document).ready(function(){
        $('[data-toggle="tooltip"]').tooltip();
    });

    $('a.confirm').click(function() {

        var link = $(this).data('link');

        bootbox.confirm({
            message: $(this).data('confirmtext'),
            buttons: {
                confirm: {
                    label: 'Ja',
                    className: 'btn-success'
                },
                cancel: {
                    label: 'Lieber nicht',
                    className: 'btn-danger'
                }
            },
            callback: function (result) {
               if (result) {
                    window.location.href = link;
               }
            }
        });
    });
});

