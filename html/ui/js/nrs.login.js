var NRS = (function(NRS, $, undefined) {
	NRS.allowLoginViaEnter = function() {
		$("#login_password").keypress(function(e) {
			if (e.which == '13') {
				e.preventDefault();
				var password = $("#login_password").val();
				NRS.login(password);
			}
		});
	}

	NRS.showLoginOrWelcomeScreen = function() {
		if (localStorage.getItem("logged_in")) {
			NRS.showLoginScreen();
		} else {
			NRS.showWelcomeScreen();
		}
	}

	NRS.showLoginScreen = function() {
		$("#account_phrase_custom_panel, #account_phrase_generator_panel, #welcome_panel, #custom_passphrase_link").hide();
		$("#account_phrase_custom_panel :input:not(:button):not([type=submit])").val("");
		$("#account_phrase_generator_panel :input:not(:button):not([type=submit])").val("");
		$("#login_panel").show();
		setTimeout(function() {
			$("#login_password").focus()
		}, 10);
		$(".center").center();
	}

	NRS.showWelcomeScreen = function() {
		$("#login_panel, account_phrase_custom_panel, #account_phrase_generator_panel, #welcome_panel, #custom_passphrase_link").hide();
		$("#welcome_panel").show();
		$(".center").center();
	}

	NRS.registerUserDefinedAccount = function() {
		$("#account_phrase_generator_panel, #login_panel, #welcome_panel, #custom_passphrase_link").hide();
		$("#account_phrase_custom_panel :input:not(:button):not([type=submit])").val("");
		$("#account_phrase_generator_panel :input:not(:button):not([type=submit])").val("");
		$("#account_phrase_custom_panel").show();
		$("#registration_password").focus();
		$(".center").center();
	}

	NRS.registerAccount = function() {
		$("#login_panel, #welcome_panel").hide();
		$("#account_phrase_generator_panel").show();
		$("#account_phrase_generator_panel step_3 .callout").hide();

		var $loading = $("#account_phrase_generator_loading");
		var $loaded = $("#account_phrase_generator_loaded");

		if (window.crypto || window.msCrypto) {
			$loading.find("span.loading_text").html("Generating your secret phrase. Please wait");
		}

		$loading.show();
		$loaded.hide();

		$(".center").center();

		if (typeof PassPhraseGenerator == "undefined") {
			$.when(
				$.getScript("js/crypto/3rdparty/seedrandom.js"),
				$.getScript("js/crypto/passphrasegenerator.js")
			).done(function() {
				$loading.hide();
				$loaded.show();

				PassPhraseGenerator.generatePassPhrase("#account_phrase_generator_panel");
			}).fail(function(jqxhr, settings, exception) {
				alert("Could not load word list...");
			});
		} else {
			$loading.hide();
			$loaded.show();

			PassPhraseGenerator.generatePassPhrase("#account_phrase_generator_panel");
		}
	}

	NRS.verifyGeneratedPassphrase = function() {
		var password = $.trim($("#account_phrase_generator_panel .step_3 textarea").val());

		if (password != PassPhraseGenerator.passPhrase) {
			$("#account_phrase_generator_panel .step_3 .callout").show();
		} else {
			NRS.login(password, function() {
				$.growl("Secret phrase confirmed successfully, you are now logged in.", {
					"type": "success"
				});
			});
			PassPhraseGenerator.reset();
			$("#account_phrase_generator_panel textarea").val("");
			$("#account_phrase_generator_panel .step_3 .callout").hide();
		}
	}

	$("#account_phrase_custom_panel form").submit(function(event) {
		event.preventDefault()

		var password = $("#registration_password").val();
		var repeat = $("#registration_password_repeat").val();

		var error = "";

		if (password.length < 35) {
			error = "Secret phrase must be at least 35 characters long.";
		} else if (password.length < 50 && (!password.match(/[A-Z]/) || !password.match(/[0-9]/))) {
			error = "Since your secret phrase is less than 50 characters long, it must contain numbers and uppercase letters.";
		} else if (password != repeat) {
			error = "Secret phrases do not match.";
		}

		if (error) {
			$("#account_phrase_custom_panel .callout").first().removeClass("callout-info").addClass("callout-danger").html(error);
		} else {
			$("#registration_password, #registration_password_repeat").val("");
			NRS.login(password, function() {
				$.growl("Secret phrase confirmed successfully, you are now logged in.", {
					"type": "success"
				});
			});
		}
	});

	NRS.login = function(password, callback) {
		$("#login_password, #registration_password, #registration_password_repeat").val("");

		if (!password.length) {
			$.growl("You must enter your secret phrase. If you don't have one, click the registration button below.", {
				"type": "danger",
				"offset": 10
			});
			return;
		}

		NRS.sendRequest("getState", function(response) {
			if (response.errorCode) {
				$.growl("Could not connect to server.", {
					"type": "danger",
					"offset": 10
				});

				return;
			}

			NRS.state = response;

			//this is done locally..
			NRS.sendRequest("getAccountId", {
				"secretPhrase": password
			}, function(response) {
				if (!response.errorCode) {
					NRS.account = String(response.accountId).escapeHTML();
				}

				if (!NRS.account) {
					return;
				}

				NRS.sendRequest("getAccountPublicKey", {
					"account": NRS.account
				}, function(response) {
					if (response && response.publicKey && response.publicKey != NRS.generatePublicKey(password)) {
						$.growl("This account is already taken. Please choose another pass phrase.", {
							"type": "danger",
							"offset": 10
						});
						return;
					}

					if ($("#remember_password").is(":checked")) {
						NRS.rememberPassword = true;
						$("#remember_password").prop("checked", false);
						sessionStorage.setItem("secret", password);
						$.growl("Remember to log out at the end of your session so as to clear the password from memory.", {
							"type": "danger"
						});
						$(".secret_phrase, .show_secret_phrase").hide();
						$(".hide_secret_phrase").show();
					}

					$("#account_id").html(NRS.getAccountFormatted(NRS.account));

					var passwordNotice = "";

					if (password.length < 35) {
						passwordNotice = "Your secret phrase is less than 35 characters long. This is not secure.";
					} else if (password.length < 50 && (!password.match(/[A-Z]/) || !password.match(/[0-9]/))) {
						passwordNotice = "Your secret phrase does not contain numbers and uppercase letters. This is not secure.";
					}

					if (passwordNotice) {
						$.growl("<strong>Warning</strong>: " + passwordNotice, {
							"type": "danger"
						});
					}

					NRS.getAccountInfo(true, function() {
						if (NRS.accountInfo.currentLeasingHeightFrom) {
							NRS.isLeased = (NRS.lastBlockHeight >= NRS.accountInfo.currentLeasingHeightFrom && NRS.lastBlockHeight <= NRS.accountInfo.currentLeasingHeightTo);
						} else {
							NRS.isLeased = false;
						}

						//forging requires password to be sent to the server, so we don't do it automatically if not localhost
						if (!NRS.accountInfo.publicKey || NRS.accountInfo.effectiveBalanceNXT == 0 || !NRS.isLocalHost) {
							$("#forging_indicator").removeClass("forging");
							$("#forging_indicator span").html("Not Forging");
							$("#forging_indicator").show();
							NRS.isForging = false;
						} else if (NRS.isLocalHost) {
							NRS.sendRequest("startForging", {
								"secretPhrase": password
							}, function(response) {
								if ("deadline" in response) {
									$("#forging_indicator").addClass("forging");
									$("#forging_indicator span").html("Forging");
									NRS.isForging = true;
								} else {
									$("#forging_indicator").removeClass("forging");
									$("#forging_indicator span").html("Not Forging");
									NRS.isForging = false;
								}
								$("#forging_indicator").show();
							});
						}
					});

					//NRS.getAccountAliases();

					NRS.unlock();

					NRS.setupClipboardFunctionality();

					if (callback) {
						callback();
					}

					NRS.checkLocationHash(password);

					$(window).on("hashchange", NRS.checkLocationHash);

					NRS.sendRequest('getAccountTransactionIds', {
						"account": NRS.account,
						"timestamp": 0
					}, function(response) {
						if (response.transactionIds && response.transactionIds.length) {
							var transactionIds = response.transactionIds.reverse().slice(0, 10);
							var nrTransactions = 0;
							var transactions = [];

							for (var i = 0; i < transactionIds.length; i++) {
								NRS.sendRequest('getTransaction', {
									"transaction": transactionIds[i]
								}, function(transaction, input) {
									nrTransactions++;

									transaction.id = input.transaction;
									transaction.confirmed = true;
									transactions.push(transaction);

									if (nrTransactions == transactionIds.length) {
										NRS.getUnconfirmedTransactions(function(unconfirmedTransactions) {
											NRS.handleInitialTransactions(transactions.concat(unconfirmedTransactions), transactionIds);
										});
									}
								});
							}
						} else {
							NRS.getUnconfirmedTransactions(function(unconfirmedTransactions) {
								NRS.handleInitialTransactions(unconfirmedTransactions, []);
							});
						}
					});
				});
			});
		});
	}

	NRS.showLockscreen = function() {
		/* CENTER ELEMENTS IN THE SCREEN */
		$.fn.center = function() {
			this.css("position", "absolute");
			this.css("top", Math.max(0, (($(window).height() - $(this).outerHeight()) / 2) +
				$(window).scrollTop()) - 30 + "px");
			this.css("left", Math.max(0, (($(window).width() - $(this).outerWidth()) / 2) +
				$(window).scrollLeft()) + "px");
			return this;
		}

		if (localStorage.getItem("logged_in")) {
			setTimeout(function() {
				$("#login_password").focus()
			}, 10);
		} else {
			NRS.showWelcomeScreen();
		}

		$(".center").center().show();
		$(window).on("resize.lockscreen", function() {
			$(".center").center();
		});
	}

	NRS.unlock = function() {
		if (!localStorage.getItem("logged_in")) {
			localStorage.setItem("logged_in", true);
		}

		$("body").removeClass("lockscreen");
		$("html").removeClass("lockscreen");
		$("#lockscreen").hide();
		$("window").off("resize.lockscreen");

		$("body").scrollTop(0);

		var userStyles = ["header", "sidebar", "page_header"];

		for (var i = 0; i < userStyles.length; i++) {
			var color = NRS.settings[userStyles[i] + "_color"];
			if (color) {
				NRS.updateStyle(userStyles[i], color);
			}
		}

		var contentHeaderHeight = $(".content-header").height();
		var navBarHeight = $("nav.navbar").height();

		$(".content-splitter-right").css("bottom", (contentHeaderHeight + navBarHeight + 10) + "px");
	}

	$("#logout_button").click(function(e) {
		if (!NRS.isForging) {
			e.preventDefault();
			NRS.logout();
		}
	});

	NRS.logout = function(stopForging) {
		if (stopForging && NRS.isForging) {
			$("#stop_forging_modal .show_logout").show();
			$("#stop_forging_modal").modal("show");
		} else {
			if (NRS.rememberPassword) {
				sessionStorage.removeItem("secret");
			}
			window.location.reload();
		}
	}

	return NRS;
}(NRS || {}, jQuery));