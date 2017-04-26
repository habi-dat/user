  $(document).ready(function(){
    var table = $('.datatable').dataTable( {
        "info":           false,
        "paging":         false,
        "oLanguage": {
          "sSearch": "Suche: "
        }
    } );


    var table = $('.datatable_nosort').dataTable( {
        "info":           false,
        "paging":         false,
        "order": [],
        "oLanguage": {
          "sSearch": "Suche: "
        }
    } );

    $('[data-toggle="tooltip"]').tooltip(); 

    $('#usertable tbody').on( 'click', 'tr', function () {
    if ( $(this).hasClass('selected') ) {
        $(this).removeClass('selected');
        $('#grouptable tbody tr').removeClass('hidden');
    }
    else {
        $('#usertable tbody tr.selected').removeClass('selected');
        $(this).addClass('selected');
        var dn = $(this).find('.dn').text();
        $('#grouptable tbody tr').addClass('hidden');
        $('#grouptable tbody tr td .memberdn').each(function() {
          if ($(this).text() == dn) {
            $(this).parent().parent().removeClass('hidden');
          }
        });
    }
    } );
    $('#grouptable tbody').on( 'click', 'tr', function () {
    if ( $(this).hasClass('selected') ) {
        $(this).removeClass('selected');
        $('#usertable tbody tr').removeClass('hidden');
    }
    else {
        $('#grouptable tbody tr.selected').removeClass('selected');
        $(this).addClass('selected');
        $('#usertable tbody tr').addClass('hidden');
        $(this).find('.memberdn').each(function() {
          var dn = $(this).text();
          $('#usertable tbody tr .dn').each(function() {
            if($(this).text() == dn) {
              $(this).parent().removeClass('hidden');
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
    $('.list-group.checked-list-box .list-group-item').each(function () {
        
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
                $widget.data('state', 'admin');
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
                $widget.removeClass(style + 'success active admin');
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

    $('#activation_checkbox').click(function() {
        $('#password_fields').toggle(1);
    });

    $('.checkbox-form').submit(function() {
        var $hidden = $("<input type='hidden' class='hidden-groups' name='groups'/>");
        var $hiddenAdmin = $("<input type='hidden' class='hidden-groups' name='admingroups'/>");
        //event.preventDefault(); 
        var checkedItems = [], counter = 0;
        $("#check-list-box li.active").each(function(idx, li) {
            checkedItems.push($(li).prop('id'));
            counter++;
        });
        $hidden.val(JSON.stringify(checkedItems));
        var adminItems = [];
        $("#check-list-box li.active.admin").each(function(idx, li) {
            adminItems.push($(li).prop('id'));
        });
        $hiddenAdmin.val(JSON.stringify(adminItems));
        $(this).find('.hidden-groups').remove();
        $(this).append($hidden);
        $(this).append($hiddenAdmin);
        return true;
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
  
  