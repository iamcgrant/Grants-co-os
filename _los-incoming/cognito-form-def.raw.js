/* eslint-disable no-undef */
(function (apiKey, formId, tmpl, model, theme, peopleFormEmailPath) {
	theme.links.map(function (url) {
		var link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = url;
		document.head.appendChild(link);
	});

	var scripts = document.head.querySelectorAll('[src*=\'svc/load-form/form-def/' + apiKey + '/' + formId + '\']');

	currentScript = document.currentScript || scripts[scripts.length - 1];
	currentScript['formDefinition'] = {
		template: tmpl,
		modelOptions: model,
		theme: theme,
		peopleFormEmailPath: peopleFormEmailPath
	};
})(
	"QZTmaMu3bEOpm_9ZKbBBPw",
	"4",
	"\u003cform\r\n\t\t\t\tref=\u0027form\u0027\r\n\t\t\t\tlang=\u0027en\u0027\r\n\t\t\t\tclass=\u0027😉 cog-cognito cog-form cog-4\u0027\r\n\t\t\t\t:class=\u0027[\"is-\"+submitStatus,\r\n\t\t\t\t\tisChameleon ? \"cog-cognito--chameleon\" : \"cog-cognito--styled\",\r\n\t\t\t\t{\r\n\t\t\t\t\t\"cog-form--light-background\": flags.forceLightBackgroundClass || (!isChameleon \u0026\u0026 true)\r\n\t\t\t\t\t,\"cog-form--dark-background\": !flags.forceLightBackgroundClass \u0026\u0026 !isChameleon \u0026\u0026 false\r\n\t\t\t\t\t,\"cog-form--maximal-branding\": flags.branding \u0026\u0026 !flags.minimalBranding\r\n\t\t\t\t\t,\"cog-form--show-all-pages\": showAllPages || !enablePaging\r\n\t\t\t\t\t,\"cog-form--confirmation-has-entry-details\": showConfirmation \u0026\u0026 entryDetailsVisible\r\n\t\t\t\t\t,\"cog-cognito--protect-css\": flags.protectCss\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t}]\u0027\r\n\t\t\t\t:aria-labelledby=\u0027flags.hideHeader ? null : \"cog-heading-4\"\u0027\r\n\t\t\t\t:aria-label=\u0027flags.hideHeader ? \"Grant \\u0026 Co Consultants  Home Buying \\u0026 Credit Readiness Intake\" : null\u0027\r\n\t\t\t\ttabindex=\u0027-1\u0027\r\n\t\t\t\t@submit.prevent\r\n\t\t\t\u003e\r\n\t\t\t\u003cdiv ref=\u0027formContainer\u0027 class=\u0027cog-form__container\u0027\u003e\u003cdiv class=\u0027cog-form__content\u0027\u003e\u003cc-header ref=\u0027header\u0027\r\n\t\t\t\t:visible=\u0027!flags.hideHeader\u0027\r\n\t\t\t\ttitle=\u0027Grant \u0026amp; Co Consultants  Home Buying \u0026amp; Credit Readiness Intake\u0027\r\n\t\t\t\t:description=\u0027available ? \"\" : \"\"\u0027\r\n\t\t\t\t:logo=\u0027typeof themeSettings.logo === \"string\" ? themeSettings.logo : \"https://www.cognitoforms.com/file/XcRdbx9Kg9ciGQDduw7U7oUm7lm45qiVY3VXUoaf_V633zLMryONg047fB4rix9I\"\u0027\r\n\t\t\t\t:alt=\u0027themeSettings.logoAlt || \"\"\u0027\r\n\t\t\t\t:show-confirmation=showConfirmation\r\n\t\t\t\t:layout=\u0027themeSettings.headerLayout || \"column\"\u0027\r\n\t\t\t\t:alignment=\u0027themeSettings.headerAlignment || \"center\"\u0027 /\u003e\u003ctemplate v-if=\u0027!flags.archived \u0026\u0026 ((available || isExistingEntry) \u0026\u0026 session.isValidSharedLink)\u0027\u003e\u003cdiv class=\u0027cog-body\u0027 ref=\u0027body\u0027\u003e\u003cc-confirmation\r\n\t\t\t\tref=\u0027confirmation\u0027\r\n\t\t\t\t:entry=\u0027entry\u0027\r\n\t\t\t\t:order=\u0027order\u0027\r\n\t\t\t\t:confirmation-message=\u0027action ? action.Confirmation.Message : null\u0027\r\n\t\t\t\t:redirect-enabled=\u0027flags.redirect\u0027\r\n\t\t\t\t:show-users-redirected=\u0027flags.showUsersRedirected\u0027\r\n\t\t\t\t:redirect-url=\u0027action ? action.Confirmation.RedirectUrl : null\u0027\r\n\t\t\t\t:visible=\u0027readonly \u0026\u0026 showConfirmation\u0027\r\n\t\t\t\t:documents=\u0027documents\u0027\r\n\t\t\t\t@show-entry-details=\u0027handleEntryDetailsVisibility\u0027\r\n\t\t\t\t@redirect=\u0027redirect\u0027\r\n\t\t\t\t@entering=\u0027confirmationEntered\u0027\r\n\t\t\t\t:include-entry-details=\u0027action ? action.Confirmation.IncludeEntryDetails : null\u0027 :action=\u0027action\u0027\u003e\u003cc-order payment-processor=\u0027\u0027 :entry=\u0027entry\u0027 :order=\u0027order\u0027 :process-payment=\u0027processPayment\u0027  v-if=\u0027showOrder\u0027 :readonly=\u0027true\u0027 :show-header=\u0027false\u0027 show-line-items show-sub-total :save-card=\u0027false\u0027 :has-payable-action=\u0027hasPayableAction\u0027 :order-amount-label=\u0027$resource(\"order-total-label\")\u0027\u003e\u003ctemplate v-slot:paymentDetails\u003e\r\n\t\t\t\t\t\u003cc-transaction-details :order=\u0027order\u0027 /\u003e\r\n\t\t\t\t\t\u003cc-billing-info :order=\u0027order\u0027 /\u003e\r\n\t\t\t\t\u003c/template\u003e\u003c/c-order\u003e\u003c/c-confirmation\u003e\u003cportal name=\"order-4\" :to=\"paymentVuePortalKey\" v-if=\"onLastPage\" \u003e\u003cc-order payment-processor=\u0027\u0027 :entry=\u0027entry\u0027 :order=\u0027order\u0027 :process-payment=\u0027processPayment\u0027  v-if=\u0027showOrder \u0026\u0026 !showConfirmation \u0026\u0026 !orderInReadonlyMode\u0027 ref=\u0027orderComponent\u0027 :payment-unavailable-highlighted=\u0027paymentUnavailableHighlighted\u0027 show-line-items show-sub-total :save-card=\u0027false\u0027 :has-payable-action=\u0027hasPayableAction\u0027 :order-amount-label=\u0027$resource(\"payment-amount-due\")\u0027\u003e\u003ctemplate\r\n\t\t\t\t\tv-if=\u0027flags.payment\u0027\r\n\t\t\t\t\tv-slot:payment=\u0027paymentSlot\u0027\u003e\r\n\t\t\t\t\t\u003cc-payment ref=\u0027paymentComponent\u0027\r\n\t\t\t\t\t\t\t:entry=\u0027entry\u0027\r\n\t\t\t\t\t\t\t:save-card=\u0027paymentSlot.saveCard\u0027\r\n\t\t\t\t\t\t\t:error-message=\u0027paymentError\u0027\r\n\t\t\t\t\t\t\t:use-theme-settings=\u0027useThemeSettings\u0027\r\n\t\t\t\t\t\t\t@authentication-complete=\u0027authenticationComplete\u0027\r\n\t\t\t\t\t\t\t@focus=\u0027resetPaymentError\u0027\r\n\t\t\t\t\t\u003e\r\n\t\t\t\t\t\t\u003ctemplate v-slot=\u0027{inputStyles, saveCard}\u0027\u003e\u003c/template\u003e\r\n\t\t\t\t\t\u003c/c-payment\u003e\r\n\t\t\t\t\u003c/template\u003e\u003c/c-order\u003e\u003c/portal\u003e\u003cc-page\r\n\t\t\t\tv-slot=\u0027pageSlot\u0027\r\n\t\t\t\t@next=\u0027navigate({forward: true, validateCaptcha: $event.validateCaptcha})\u0027\r\n\t\t\t\t@back=\u0027navigate({forward: false})\u0027\r\n\t\t\t\t@save=\u0027save({validateCaptcha: $event.validateCaptcha})\u0027\r\n\t\t\t\t@beforeEnter=\u0027pageBeforeEnter\u0027\r\n\t\t\t\t@entering=\u0027pageEntering\u0027\r\n\t\t\t\t@entered=\u0027pageEntered\u0027\r\n\t\t\t\t@clicked-submit=\u0027handleSubmit($event)\u0027\r\n\t\t\t\t:submit-button=\u0027nextButton\u0027\r\n\t\t\t\t:show-submission-warning=\u0027flags.showSubmissionWarning\u0027\r\n\t\t\t\t:is-submission=\u0027lastVisiblePageNumber === 1\u0027\r\n\t\t\t\t:submit-status=\u0027submitStatus\u0027\r\n\t\t\t\t:save-status=\u0027saveStatus\u0027\r\n\t\t\t\t:allow-save=\u0027flags.saveAndResume\u0027\r\n\t\t\t\t:paging=\u0027enablePaging\u0027\r\n\t\t\t\t:show-navigation=\u0027showNavigation \u0026\u0026 flags.submissionSettings \u0026\u0026 !showConfirmation\u0027\r\n\t\t\t\t:visible=\u0027true\u0027\r\n\t\t\t\t:current=\u0027showAllPages || !enablePaging || (pageNumber === 1 \u0026\u0026 !showConfirmation)\u0027\r\n\t\t\t\t:number=\u00271\u0027\r\n\t\t\t\t:hide-number=\u0027!enablePaging || readonly || false\u0027\r\n\t\t\t\t:visible-number=\u0027visiblePageNumber\u0027\r\n\t\t\t\tnext-button=\u0027Submit\u0027 title=\u0027\u0027 :allowed-actions=\u0027allowedActions\u0027 :current-action=\u0027action\u0027\u003e\u003cc-order payment-processor=\u0027\u0027 :entry=\u0027entry\u0027 :order=\u0027order\u0027 :process-payment=\u0027processPayment\u0027  v-if=\u0027showOrder \u0026\u0026 !showConfirmation \u0026\u0026 orderInReadonlyMode\u0027 :readonly=\u0027true\u0027 :show-header=\u0027false\u0027 show-line-items show-sub-total :save-card=\u0027false\u0027 :has-payable-action=\u0027hasPayableAction\u0027 :order-amount-label=\u0027$resource(\"order-total-label\")\u0027\u003e\u003ctemplate v-slot:paymentDetails\u003e\r\n\t\t\t\t\t\u003cc-transaction-details :order=\u0027order\u0027 /\u003e\r\n\t\t\t\t\t\u003cc-billing-info :order=\u0027order\u0027 /\u003e\r\n\t\t\t\t\u003c/template\u003e\u003c/c-order\u003e\u003cc-row key=\u0027row-0\u0027\u003e\u003cc-section source=\u0027Section1ClientInformation\u0027 v-slot=\u0027sectionSlot\u0027 field-index=\u00272\u0027 \u003e\u003cc-row key=\u0027row-1\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027FullName\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027name\u0027\r\n\t\t\t\t\tsubtype=\u0027none\u0027\r\n\t\t\t\t\tfield-index=\u00272\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\u003e\u003cc-name :name=\u0027fieldSlot.field.value\u0027  :readonly=\u0027fieldSlot.field.readonly\u0027 properties=\u0027First,Last\u0027 format=\u0027[First] [Last]\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-2\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027PhoneNumber\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027phone\u0027\r\n\t\t\t\t\tsubtype=\u0027usphone\u0027\r\n\t\t\t\t\tfield-index=\u00273\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\u003e\u003cc-input :type=\u0027flags.mobile ? \"tel\" : \"text\"\u0027  :id=\u0027fieldSlot.field.id\u0027 v-model=\u0027fieldSlot.field.displayValue\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 mask=\u0027(###) ###-#### x########\u0027 autocomplete=\u0027tel-national\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-3\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027EmailAddress\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027email\u0027\r\n\t\t\t\t\tsubtype=\u0027none\u0027\r\n\t\t\t\t\tfield-index=\u00274\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\u003e\u003cc-input :type=\u0027flags.mobile ? \"email\" : \"text\"\u0027 autocomplete=\u0027email\u0027  :id=\u0027fieldSlot.field.id\u0027 v-model=\u0027fieldSlot.field.displayValue\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-4\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027DateOfBirth\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027date\u0027\r\n\t\t\t\t\tsubtype=\u0027date\u0027\r\n\t\t\t\t\tfield-index=\u00275\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\u003e\u003cc-date :chameleon=\u0027isChameleon\u0027 :mobile=\u0027flags.mobile\u0027  :id=\u0027fieldSlot.field.id\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 v-model=\u0027fieldSlot.field.displayValue\u0027 scope=\u00274\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-5\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027SocialSecurityNumber\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027text\u0027\r\n\t\t\t\t\tsubtype=\u0027singleline\u0027\r\n\t\t\t\t\tfield-index=\u00276\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\u003e\u003cc-input type=\u0027text\u0027  :id=\u0027fieldSlot.field.id\u0027 v-model=\u0027fieldSlot.field.displayValue\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-6\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027CurrentAddressFullAddressWithCityStateZip\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027address\u0027\r\n\t\t\t\t\tsubtype=\u0027usaddress\u0027\r\n\t\t\t\t\tfield-index=\u00277\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\u003e\u003cc-address :address=\u0027fieldSlot.field.value\u0027  :id=\u0027fieldSlot.field.id\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 type=\u0027us\u0027 properties=\u0027Line1,Line2,City,State,PostalCode\u0027 scope=\u00274\u0027 :chameleon=\u0027isChameleon\u0027 :mobile=\u0027flags.mobile\u0027 :autocomplete=\u0027false\u0027  /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003c/c-section\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-7\u0027\u003e\u003cc-section source=\u0027Section2IDVerification\u0027 v-slot=\u0027sectionSlot\u0027 field-index=\u00273\u0027 \u003e\u003cc-row key=\u0027row-8\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027UploadDriversLicenseOrStateID\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027file\u0027\r\n\t\t\t\t\tsubtype=\u0027none\u0027\r\n\t\t\t\t\tfield-index=\u00272\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\u003e\u003cc-upload  :id=\u0027fieldSlot.field.id\u0027 v-model=\u0027fieldSlot.field.value\u0027:max-files=\u002710\u0027:max-size=\u0027session.fileUploadLimit\u0027 :allowed-types=\u0027[\"jpg\",\"jpeg\",\"png\",\"pdf\"]\u0027 :banned-types=\u0027[\"action\",\"apk\",\"app\",\"bat\",\"bin\",\"cmd\",\"com\",\"command\",\"cpl\",\"csh\",\"dll\",\"exe\",\"htm\",\"html\",\"gadget\",\"inf1\",\"ins\",\"inx\",\"ipa\",\"isu\",\"job\",\"js\",\"jse\",\"ksh\",\"lnk\",\"msc\",\"msi\",\"msp\",\"mst\",\"osx\",\"out\",\"paf\",\"pif\",\"prg\",\"ps1\",\"pyd\",\"pyw\",\"pyz\",\"pyzw\",\"reg\",\"rgs\",\"run\",\"scr\",\"sct\",\"sh\",\"shb\",\"shs\",\"u3p\",\"vb\",\"vbe\",\"vbs\",\"vbscript\",\"workflow\",\"ws\",\"wsf\",\"wsh\"]\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 :encrypt=\u0027flags.encrypt\u0027 :file-service=\u0027fileService\u0027 @file-uploaded=\u0027fileUploaded\u0027 @focus-removed=\u0027recordFocusPlace\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003c/c-section\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-9\u0027\u003e\u003cc-section source=\u0027Section3CreditProgramSelection\u0027 v-slot=\u0027sectionSlot\u0027 field-index=\u00274\u0027 \u003e\u003cc-row key=\u0027row-10\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027AreYouIncludingCreditRepairWithYourHomePackage\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027choice\u0027\r\n\t\t\t\t\tsubtype=\u0027radiobuttons\u0027\r\n\t\t\t\t\tfield-index=\u00272\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\u003e\u003cc-choice v-slot=\u0027choiceSlot\u0027 :checkable=\u0027true\u0027 :columns=\u00270\u0027 :file-service=\u0027fileService\u0027  :choices=\u0027fieldSlot.field.lastTarget.AreYouIncludingCreditRepairWithYourHomePackage_Choices\u0027\u003e\u003cc-radio-group @focus-lost=\u0027fieldSlot.focusLost\u0027 :options=\u0027choiceSlot.options\u0027 :columns=\u00270\u0027   :readonly=\u0027fieldSlot.field.readonly\u0027 v-model=\u0027fieldSlot.field.displayValue\u0027 :hide-choice-labels=\u0027false\u0027 images-in-choice-fields-enabled /\u003e\u003c/c-choice\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-11\u0027\u003e\u003cc-col  :parent-cols=\u0027sectionSlot.cols\u0027\u003e\u003cc-content content=\u0027\u0026lt;p\u003e\u0026lt;strong\u003eCredit Repair Instruction (If Yes)\u0026lt;/strong\u003e\u0026lt;/p\u003e\u0026lt;p\u003eYou must create a Credit Hero Score account immediately after submitting this form. This is required to begin your credit process.\u0026lt;/p\u003e\u0027 /\u003e\u003c/c-col\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-12\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027UploadScreenshotOrConfirmationOfCreditHeroScoreAccount\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027file\u0027\r\n\t\t\t\t\tsubtype=\u0027none\u0027\r\n\t\t\t\t\tfield-index=\u00273\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\u003e\u003cc-upload  :id=\u0027fieldSlot.field.id\u0027 v-model=\u0027fieldSlot.field.value\u0027:max-files=\u002710\u0027:max-size=\u0027session.fileUploadLimit\u0027 :allowed-types=\u0027[\"jpg\",\"jpeg\",\"png\",\"pdf\"]\u0027 :banned-types=\u0027[\"action\",\"apk\",\"app\",\"bat\",\"bin\",\"cmd\",\"com\",\"command\",\"cpl\",\"csh\",\"dll\",\"exe\",\"htm\",\"html\",\"gadget\",\"inf1\",\"ins\",\"inx\",\"ipa\",\"isu\",\"job\",\"js\",\"jse\",\"ksh\",\"lnk\",\"msc\",\"msi\",\"msp\",\"mst\",\"osx\",\"out\",\"paf\",\"pif\",\"prg\",\"ps1\",\"pyd\",\"pyw\",\"pyz\",\"pyzw\",\"reg\",\"rgs\",\"run\",\"scr\",\"sct\",\"sh\",\"shb\",\"shs\",\"u3p\",\"vb\",\"vbe\",\"vbs\",\"vbscript\",\"workflow\",\"ws\",\"wsf\",\"wsh\"]\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 :encrypt=\u0027flags.encrypt\u0027 :file-service=\u0027fileService\u0027 @file-uploaded=\u0027fileUploaded\u0027 @focus-removed=\u0027recordFocusPlace\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-13\u0027\u003e\u003cc-col  :parent-cols=\u0027sectionSlot.cols\u0027\u003e\u003cc-content content=\u0027\u0026lt;p\u003e\u0026lt;strong\u003eMyFICO Instruction (If No)\u0026lt;/strong\u003e\u0026lt;/p\u003e\u0026lt;p\u003eYou must provide your MyFICO mortgage scores. Minimum qualifying score is 620.\u0026lt;/p\u003e\u0027 /\u003e\u003c/c-col\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-14\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027UploadMyFICOMortgageScoreScreenshot\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027file\u0027\r\n\t\t\t\t\tsubtype=\u0027none\u0027\r\n\t\t\t\t\tfield-index=\u00274\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\u003e\u003cc-upload  :id=\u0027fieldSlot.field.id\u0027 v-model=\u0027fieldSlot.field.value\u0027:max-files=\u002710\u0027:max-size=\u0027session.fileUploadLimit\u0027 :allowed-types=\u0027[\"jpg\",\"jpeg\",\"png\",\"pdf\"]\u0027 :banned-types=\u0027[\"action\",\"apk\",\"app\",\"bat\",\"bin\",\"cmd\",\"com\",\"command\",\"cpl\",\"csh\",\"dll\",\"exe\",\"htm\",\"html\",\"gadget\",\"inf1\",\"ins\",\"inx\",\"ipa\",\"isu\",\"job\",\"js\",\"jse\",\"ksh\",\"lnk\",\"msc\",\"msi\",\"msp\",\"mst\",\"osx\",\"out\",\"paf\",\"pif\",\"prg\",\"ps1\",\"pyd\",\"pyw\",\"pyz\",\"pyzw\",\"reg\",\"rgs\",\"run\",\"scr\",\"sct\",\"sh\",\"shb\",\"shs\",\"u3p\",\"vb\",\"vbe\",\"vbs\",\"vbscript\",\"workflow\",\"ws\",\"wsf\",\"wsh\"]\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 :encrypt=\u0027flags.encrypt\u0027 :file-service=\u0027fileService\u0027 @file-uploaded=\u0027fileUploaded\u0027 @focus-removed=\u0027recordFocusPlace\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003c/c-section\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-15\u0027\u003e\u003cc-section source=\u0027Section4DownPaymentAssistance\u0027 v-slot=\u0027sectionSlot\u0027 field-index=\u00275\u0027 \u003e\u003cc-row key=\u0027row-16\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027IAmInterestedInDownPaymentAssistance1800\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027yesno\u0027\r\n\t\t\t\t\tsubtype=\u0027checkbox\u0027\r\n\t\t\t\t\tfield-index=\u00272\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :hide-label=\u0027!$source.readonly\u0027\u003e\u003cc-checkbox  :label=\u0027fieldSlot.field.label\u0027 :inactive-text=\u0027fieldSlot.field.options[1].displayValue\u0027 :active-text=\u0027fieldSlot.field.options[0].displayValue\u0027  :required=\u0027fieldSlot.field.required\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 v-model=\u0027fieldSlot.field.value\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-17\u0027\u003e\u003cc-col  :parent-cols=\u0027sectionSlot.cols\u0027\u003e\u003cc-content content=\u0027\u0026lt;p\u003e\u0026lt;strong\u003eDown Payment Assistance Note\u0026lt;/strong\u003e\u0026lt;/p\u003e\u0026lt;p\u003eDown Payment Assistance will be added to your package. This still keeps you at a discounted rate compared to standard closing costs. We recommend new construction homes such as DR Horton to maximize incentives.\u0026lt;/p\u003e\u0027 /\u003e\u003c/c-col\u003e\u003c/c-row\u003e\u003c/c-section\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-18\u0027\u003e\u003cc-section source=\u0027Section5ProcessDisclosure\u0027 v-slot=\u0027sectionSlot\u0027 field-index=\u00276\u0027 \u003e\u003cc-row key=\u0027row-19\u0027\u003e\u003cc-col  :parent-cols=\u0027sectionSlot.cols\u0027\u003e\u003cc-content content=\u0027\u0026lt;p\u003e\u0026lt;strong\u003eAccount Creation Disclosure\u0026lt;/strong\u003e\u0026lt;/p\u003e\u0026lt;p\u003eYou understand that a separate name, phone number, and email will be created on your behalf for lender and transaction purposes. Upon closing, you will receive all login credentials and account access.\u0026lt;/p\u003e\u0027 /\u003e\u003c/c-col\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-20\u0027\u003e\u003cc-col  :parent-cols=\u0027sectionSlot.cols\u0027\u003e\u003cc-content content=\u0027\u0026lt;p\u003e\u0026lt;strong\u003eAgent Assignment\u0026lt;/strong\u003e\u0026lt;/p\u003e\u0026lt;p\u003eOur in-house agent, Taylor Carroll, will assist with showings, negotiations, and transaction coordination throughout the home buying process.\u0026lt;/p\u003e\u0027 /\u003e\u003c/c-col\u003e\u003c/c-row\u003e\u003c/c-section\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-21\u0027\u003e\u003cc-section source=\u0027Section6CreditPurchaseRules\u0027 v-slot=\u0027sectionSlot\u0027 field-index=\u00277\u0027 \u003e\u003cc-row key=\u0027row-22\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027IAgreeNotToApplyForNewCreditDuringThisProcess\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027yesno\u0027\r\n\t\t\t\t\tsubtype=\u0027checkbox\u0027\r\n\t\t\t\t\tfield-index=\u00272\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :hide-label=\u0027!$source.readonly\u0027\u003e\u003cc-checkbox  :label=\u0027fieldSlot.field.label\u0027 :inactive-text=\u0027fieldSlot.field.options[1].displayValue\u0027 :active-text=\u0027fieldSlot.field.options[0].displayValue\u0027  :required=\u0027fieldSlot.field.required\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 v-model=\u0027fieldSlot.field.value\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-23\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027IAgreeNotToMakeLargePurchases\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027yesno\u0027\r\n\t\t\t\t\tsubtype=\u0027checkbox\u0027\r\n\t\t\t\t\tfield-index=\u00273\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :hide-label=\u0027!$source.readonly\u0027\u003e\u003cc-checkbox  :label=\u0027fieldSlot.field.label\u0027 :inactive-text=\u0027fieldSlot.field.options[1].displayValue\u0027 :active-text=\u0027fieldSlot.field.options[0].displayValue\u0027  :required=\u0027fieldSlot.field.required\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 v-model=\u0027fieldSlot.field.value\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-24\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027IAgreeNotToAddOrRemoveAccountsWithoutApproval\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027yesno\u0027\r\n\t\t\t\t\tsubtype=\u0027checkbox\u0027\r\n\t\t\t\t\tfield-index=\u00274\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :hide-label=\u0027!$source.readonly\u0027\u003e\u003cc-checkbox  :label=\u0027fieldSlot.field.label\u0027 :inactive-text=\u0027fieldSlot.field.options[1].displayValue\u0027 :active-text=\u0027fieldSlot.field.options[0].displayValue\u0027  :required=\u0027fieldSlot.field.required\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 v-model=\u0027fieldSlot.field.value\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-25\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027IUnderstandThisMayNegativelyImpactMyApproval\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027yesno\u0027\r\n\t\t\t\t\tsubtype=\u0027checkbox\u0027\r\n\t\t\t\t\tfield-index=\u00275\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :hide-label=\u0027!$source.readonly\u0027\u003e\u003cc-checkbox  :label=\u0027fieldSlot.field.label\u0027 :inactive-text=\u0027fieldSlot.field.options[1].displayValue\u0027 :active-text=\u0027fieldSlot.field.options[0].displayValue\u0027  :required=\u0027fieldSlot.field.required\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 v-model=\u0027fieldSlot.field.value\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003c/c-section\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-26\u0027\u003e\u003cc-section source=\u0027Section7PaymentCommitment\u0027 v-slot=\u0027sectionSlot\u0027 field-index=\u00278\u0027 \u003e\u003cc-row key=\u0027row-27\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027IUnderstandThisIsANonrefundableServiceAndPaymentMustBeMadeBeforeServicesBegin\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027yesno\u0027\r\n\t\t\t\t\tsubtype=\u0027checkbox\u0027\r\n\t\t\t\t\tfield-index=\u00272\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :hide-label=\u0027!$source.readonly\u0027\u003e\u003cc-checkbox  :label=\u0027fieldSlot.field.label\u0027 :inactive-text=\u0027fieldSlot.field.options[1].displayValue\u0027 :active-text=\u0027fieldSlot.field.options[0].displayValue\u0027  :required=\u0027fieldSlot.field.required\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 v-model=\u0027fieldSlot.field.value\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-28\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027IUnderstandServicesWillNotBeginUntilPaymentHasCleared\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027yesno\u0027\r\n\t\t\t\t\tsubtype=\u0027checkbox\u0027\r\n\t\t\t\t\tfield-index=\u00273\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :hide-label=\u0027!$source.readonly\u0027\u003e\u003cc-checkbox  :label=\u0027fieldSlot.field.label\u0027 :inactive-text=\u0027fieldSlot.field.options[1].displayValue\u0027 :active-text=\u0027fieldSlot.field.options[0].displayValue\u0027  :required=\u0027fieldSlot.field.required\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 v-model=\u0027fieldSlot.field.value\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003c/c-section\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-29\u0027\u003e\u003cc-section source=\u0027Section8CancellationFees\u0027 v-slot=\u0027sectionSlot\u0027 field-index=\u00279\u0027 \u003e\u003cc-row key=\u0027row-30\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027IUnderstandThatIfICancelAfterStartingThisProcessIWillIncurA1800CancellationFeePayableToTheRealtyCompany\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027yesno\u0027\r\n\t\t\t\t\tsubtype=\u0027checkbox\u0027\r\n\t\t\t\t\tfield-index=\u00272\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :hide-label=\u0027!$source.readonly\u0027\u003e\u003cc-checkbox  :label=\u0027fieldSlot.field.label\u0027 :inactive-text=\u0027fieldSlot.field.options[1].displayValue\u0027 :active-text=\u0027fieldSlot.field.options[0].displayValue\u0027  :required=\u0027fieldSlot.field.required\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 v-model=\u0027fieldSlot.field.value\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-31\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027IUnderstandThisIsNotAProcessWhereICanStartAndChangeMyMind\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027yesno\u0027\r\n\t\t\t\t\tsubtype=\u0027checkbox\u0027\r\n\t\t\t\t\tfield-index=\u00273\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :hide-label=\u0027!$source.readonly\u0027\u003e\u003cc-checkbox  :label=\u0027fieldSlot.field.label\u0027 :inactive-text=\u0027fieldSlot.field.options[1].displayValue\u0027 :active-text=\u0027fieldSlot.field.options[0].displayValue\u0027  :required=\u0027fieldSlot.field.required\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 v-model=\u0027fieldSlot.field.value\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003c/c-section\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-32\u0027\u003e\u003cc-section source=\u0027Section9LegalDisclosure\u0027 v-slot=\u0027sectionSlot\u0027 field-index=\u002710\u0027 \u003e\u003cc-row key=\u0027row-33\u0027\u003e\u003cc-col  :parent-cols=\u0027sectionSlot.cols\u0027\u003e\u003cc-content content=\u0027\u0026lt;p\u003e\u0026lt;strong\u003eNo Guarantees\u0026lt;/strong\u003e\u0026lt;/p\u003e\u0026lt;p\u003eNo outcome, credit score increase, loan approval, interest rate, or property acquisition is guaranteed.\u0026lt;/p\u003e\u0027 /\u003e\u003c/c-col\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-34\u0027\u003e\u003cc-col  :parent-cols=\u0027sectionSlot.cols\u0027\u003e\u003cc-content content=\u0027\u0026lt;p\u003e\u0026lt;strong\u003eClient Financial Responsibilities\u0026lt;/strong\u003e\u0026lt;/p\u003e\u0026lt;p\u003eClient is responsible for all home buying costs including inspections, appraisals, earnest money, down payment, and closing costs. \u0026lt;/p\u003e\u0027 /\u003e\u003c/c-col\u003e\u003c/c-row\u003e\u003c/c-section\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-35\u0027\u003e\u003cc-section source=\u0027Section10Signature\u0027 v-slot=\u0027sectionSlot\u0027 field-index=\u002711\u0027 \u003e\u003cc-row key=\u0027row-36\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027FullNameTypedSignature\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027name\u0027\r\n\t\t\t\t\tsubtype=\u0027none\u0027\r\n\t\t\t\t\tfield-index=\u00272\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\u003e\u003cc-name :name=\u0027fieldSlot.field.value\u0027  :readonly=\u0027fieldSlot.field.readonly\u0027 properties=\u0027First,Last\u0027 format=\u0027[First] [Last]\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-37\u0027\u003e\u003cc-field  v-if=\u0027flags.signatureField || !flags.conditionalVisibility\u0027\r\n\t\t\t\t\tsource=\u0027SignatureDrawn\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027signature\u0027\r\n\t\t\t\t\tsubtype=\u0027none\u0027\r\n\t\t\t\t\tfield-index=\u00273\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\u003e\u003cc-signature :signature=\u0027fieldSlot.field.value\u0027  :id=\u0027fieldSlot.field.id\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 :mobile=\u0027flags.mobile\u0027 :file-service=\u0027fileService\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-38\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027DateAuto\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027date\u0027\r\n\t\t\t\t\tsubtype=\u0027date\u0027\r\n\t\t\t\t\tfield-index=\u00274\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\u003e\u003cc-date :chameleon=\u0027isChameleon\u0027 :mobile=\u0027flags.mobile\u0027  :id=\u0027fieldSlot.field.id\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 v-model=\u0027fieldSlot.field.displayValue\u0027 scope=\u00274\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003cc-row key=\u0027row-39\u0027\u003e\u003cc-field \r\n\t\t\t\t\tsource=\u0027IAgreeToAllTermsAndAuthorizeGrantCoConsultantsToProceed\u0027\r\n\t\t\t\t\tv-slot=\u0027fieldSlot\u0027\r\n\t\t\t\t\ttype=\u0027yesno\u0027\r\n\t\t\t\t\tsubtype=\u0027checkbox\u0027\r\n\t\t\t\t\tfield-index=\u00275\u0027\r\n\t\t\t\t\t:render=\u0027!pageSlot.virtual\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :parent-cols=\u0027sectionSlot.cols\u0027\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t :hide-label=\u0027!$source.readonly\u0027\u003e\u003cc-checkbox  :label=\u0027fieldSlot.field.label\u0027 :inactive-text=\u0027fieldSlot.field.options[1].displayValue\u0027 :active-text=\u0027fieldSlot.field.options[0].displayValue\u0027  :required=\u0027fieldSlot.field.required\u0027 :readonly=\u0027fieldSlot.field.readonly\u0027 v-model=\u0027fieldSlot.field.value\u0027 /\u003e\u003c/c-field\u003e\u003c/c-row\u003e\u003c/c-section\u003e\u003c/c-row\u003e\u003cportal-target :name=\"paymentVuePortalKey\" v-if=\"!showPageBreaks || (onLastPage \u0026\u0026 currentPage.number === 1)\" /\u003e\u003c/c-page\u003e\u003c/div\u003e\u003cc-save-resume-dialog\r\n\t\t\t\tv-if=\u0027flags.saveAndResume \u0026\u0026 flags.submissionSettings \u0026\u0026 showSaveAndResumeDialog\u0027\r\n\t\t\t\tv-bind=\u0027saveResumeInfo\u0027\r\n\t\t\t\t:embedded=\u0027flags.embedded\u0027\r\n\t\t\t\t\r\n\t\t\t\t@send-email=\u0027emailResumeLink\u0027\r\n\t\t\t\t@close=\u0027closeSaveResumeDialog\u0027 /\u003e\u003c/template\u003e\u003ctemplate v-else-if=\u0027!session.isValidSharedLink\u0027 \u003e\u003cc-invalid-form type=\u0027invalid-share-link\u0027 :not-available-message=\u0027notAvailableMessage\u0027 /\u003e\u003c/template\u003e\u003ctemplate v-else\u003e\u003cc-invalid-form type=\u0027form-not-available\u0027 not-available-message=\u0027This form is not currently available.\u0027 /\u003e\u003c/template\u003e\u003cc-abuse v-if=\u0027flags.abuseLink\u0027 /\u003e\u003cc-branding v-if=\u0027flags.branding\u0027 :needs-font=\u0027true\u0027 :minimal-branding=\u0027flags.minimalBranding\u0027 CRSReferral=\u0027https://www.cognitoforms.com//?crs=cmVmcHVibGljOjpHcmFudENvQ29uc3VsdGFudHM=\u0026utm_source=Customer-Referral\u0026utm_medium=form\u0026utm_campaign=Form\u0027 /\u003e\u003c/div\u003e\u003c/div\u003e\u003c/form\u003e",
	(function(core, getModule) {
var Cognito = {};
var options = 
{
  $locale: "en",
  $version: 12,
  $namespace: Cognito,
  $culture: {"name":"en-US","dateTimeFormat":{"AMDesignator":"AM","Calendar":{"MinSupportedDateTime":"\/Date(-62135596800000)\/","MaxSupportedDateTime":"\/Date(253402300799999)\/","AlgorithmType":1,"CalendarType":1,"Eras":[1],"TwoDigitYearMax":2049,"IsReadOnly":false},"DateSeparator":"/","FirstDayOfWeek":0,"CalendarWeekRule":0,"FullDateTimePattern":"dddd, MMMM d, yyyy h:mm:ss tt","LongDatePattern":"dddd, MMMM d, yyyy","LongTimePattern":"h:mm:ss tt","MonthDayPattern":"MMMM d","PMDesignator":"PM","RFC1123Pattern":"ddd, dd MMM yyyy HH\u0027:\u0027mm\u0027:\u0027ss \u0027GMT\u0027","ShortDatePattern":"M/d/yyyy","ShortTimePattern":"h:mm tt","SortableDateTimePattern":"yyyy\u0027-\u0027MM\u0027-\u0027dd\u0027T\u0027HH\u0027:\u0027mm\u0027:\u0027ss","TimeSeparator":":","UniversalSortableDateTimePattern":"yyyy\u0027-\u0027MM\u0027-\u0027dd HH\u0027:\u0027mm\u0027:\u0027ss\u0027Z\u0027","YearMonthPattern":"MMMM yyyy","AbbreviatedDayNames":["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],"ShortestDayNames":["Su","Mo","Tu","We","Th","Fr","Sa"],"DayNames":["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],"AbbreviatedMonthNames":["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",""],"MonthNames":["January","February","March","April","May","June","July","August","September","October","November","December",""],"IsReadOnly":false,"NativeCalendarName":"Gregorian Calendar","AbbreviatedMonthGenitiveNames":["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",""],"MonthGenitiveNames":["January","February","March","April","May","June","July","August","September","October","November","December",""]},"numberFormat":{"CurrencyDecimalDigits":2,"CurrencyDecimalSeparator":".","IsReadOnly":false,"CurrencyGroupSizes":[3],"NumberGroupSizes":[3],"PercentGroupSizes":[3],"CurrencyGroupSeparator":",","CurrencySymbol":"$","NaNSymbol":"NaN","CurrencyNegativePattern":0,"NumberNegativePattern":1,"PercentPositivePattern":1,"PercentNegativePattern":1,"NegativeInfinitySymbol":"-∞","NegativeSign":"-","NumberDecimalDigits":2,"NumberDecimalSeparator":".","NumberGroupSeparator":",","CurrencyPositivePattern":0,"PositiveInfinitySymbol":"∞","PositiveSign":"+","PercentDecimalDigits":2,"PercentDecimalSeparator":".","PercentGroupSeparator":",","PercentSymbol":"%","PerMilleSymbol":"‰","NativeDigits":["0","1","2","3","4","5","6","7","8","9"],"DigitSubstitution":1}},
  'LookupSourceEntity': {
    $abstract: true,
    Id: {
      identifier: true,
      label: "Id",
      type: String
    }
  },
  'Forms.FormEntry': {
    $extends: "LookupSourceEntity",
    Entry: {
      label: "Entry",
      type: 'Forms.EntryMeta'
    },
    Form: {
      label: "Form",
      type: 'Forms.FormRef'
    }
  },
  'Forms.EntryMeta': {
    Action: {
      label: "Action",
      type: String
    },
    AdminLink: {
      label: "Admin Link",
      type: String
    },
    CustomerCard: {
      label: "Customer Card",
      type: 'Payment.CustomerCard'
    },
    DateCreated: {
      label: "Date Created",
      default: null,
      format: "g",
      type: Date
    },
    DateSubmitted: {
      label: "Date Submitted",
      default: null,
      format: "g",
      type: Date
    },
    DateUpdated: {
      label: "Date Updated",
      default: null,
      format: "g",
      type: Date
    },
    EditLink: {
      label: "Edit Link",
      type: String
    },
    IsBeta: {
      label: "Is Beta",
      type: Boolean
    },
    LastPageViewed: {
      label: "Last Page Viewed",
      type: String
    },
    Number: {
      label: "Number",
      default: null,
      format: "N0",
      type: Number
    },
    Order: {
      label: "Order",
      type: 'Payment.OrderRef'
    },
    Origin: {
      label: "Origin",
      type: 'Origin'
    },
    PaymentToken: {
      label: "Payment Token",
      type: 'Payment.PaymentToken'
    },
    Role: {
      label: "Role",
      type: String
    },
    Status: {
      label: "Status",
      type: String
    },
    Timestamp: {
      label: "Timestamp",
      default: null,
      format: "g",
      type: Date
    },
    User: {
      label: "User",
      type: 'Forms.UserInfo'
    },
    Version: {
      label: "Version",
      format: "N0",
      type: Number
    },
    ViewLink: {
      label: "View Link",
      type: String
    }
  },
  'Payment.CustomerCard': {
    Card: {
      label: "Card",
      type: 'Payment.CardInformation'
    },
    CustomerCardId: {
      label: "Customer Card Id",
      type: String
    },
    CustomerId: {
      label: "Customer Id",
      type: String
    },
    EmailAddress: {
      label: "Email Address",
      type: String
    },
    ReferenceUrl: {
      label: "Reference Url",
      type: String
    },
    Status: {
      label: "Status",
      format: "[DisplayName]",
      type: 'Payment.CustomerCardStatus'
    }
  },
  'Payment.CardInformation': {
    Brand: {
      label: "Brand",
      type: String
    },
    Country: {
      label: "Country",
      type: String
    },
    ExpMonth: {
      label: "Exp Month",
      format: "N0",
      type: Number
    },
    ExpYear: {
      label: "Exp Year",
      format: "N0",
      type: Number
    },
    Fingerprint: {
      label: "Fingerprint",
      type: String
    },
    Last4: {
      label: "Last4",
      type: String
    }
  },
  'Payment.CustomerCardStatus': {
    $enum: [
      "Unspecified",
      "PendingAction",
      "Confirmed"
    ],
    $format: "[DisplayName]",
    Id: {
      identifier: true,
      label: "Id",
      type: Number
    },
    Name: {
      label: "Name",
      type: String
    },
    DisplayName: {
      label: "Display Name",
      type: String
    }
  },
  'Payment.OrderRef': {
    Date: {
      label: "Date",
      default: null,
      format: "g",
      type: Date
    },
    Id: {
      identifier: true,
      label: "Id",
      type: String
    },
    PaymentMessage: {
      label: "Payment Message",
      type: String
    },
    PaymentStatus: {
      label: "Payment Status",
      format: "[DisplayName]",
      type: 'Payment.PaymentStatus'
    }
  },
  'Payment.PaymentStatus': {
    $enum: [
      "New",
      "Unpaid",
      "Pending",
      "Paid",
      "Declined",
      "Refunded",
      "Cancelled",
      "Disputed",
      "Reversed",
      "PartiallyReversed",
      "PartiallyRefunded",
      "PartiallyPaid",
      "Quote"
    ],
    $format: "[DisplayName]",
    Id: {
      identifier: true,
      label: "Id",
      type: Number
    },
    Name: {
      label: "Name",
      type: String
    },
    DisplayName: {
      label: "Display Name",
      type: String
    }
  },
  'Origin': {
    City: {
      label: "City",
      type: String
    },
    CountryCode: {
      label: "Country Code",
      type: String
    },
    IpAddress: {
      label: "Ip Address",
      type: String
    },
    IsImported: {
      label: "Is Imported",
      type: Boolean
    },
    Region: {
      label: "Region",
      type: String
    },
    Timezone: {
      label: "Timezone",
      type: String
    },
    UserAgent: {
      label: "User Agent",
      type: String
    }
  },
  'Payment.PaymentToken': {
    Card: {
      label: "Card",
      type: 'Payment.CardInformation'
    },
    ClientSecret: {
      label: "Client Secret",
      type: String
    },
    CustomerId: {
      label: "Customer Id",
      type: String
    },
    DateCreated: {
      label: "Date Created",
      default: null,
      format: "g",
      type: Date
    },
    IsLive: {
      label: "Is Live",
      type: Boolean
    },
    SaveForFutureUse: {
      label: "Save For Future Use",
      type: Boolean
    },
    Status: {
      label: "Status",
      format: "[DisplayName]",
      type: 'Payment.PaymentTokenStatus'
    },
    Token: {
      label: "Token",
      type: String
    },
    TransactionId: {
      label: "Transaction Id",
      type: String
    },
    Type: {
      label: "Type",
      type: String
    },
    VerificationToken: {
      label: "Verification Token",
      type: String
    }
  },
  'Payment.PaymentTokenStatus': {
    $enum: [
      "Unspecified",
      "PendingPayment",
      "PendingSaveCard",
      "PendingAction",
      "Confirmed",
      "AuthenticationSucceeded",
      "AuthenticationFailed"
    ],
    $format: "[DisplayName]",
    Id: {
      identifier: true,
      label: "Id",
      type: Number
    },
    Name: {
      label: "Name",
      type: String
    },
    DisplayName: {
      label: "Display Name",
      type: String
    }
  },
  'Forms.UserInfo': {
    Email: {
      label: "Email",
      type: String
    },
    Name: {
      label: "Name",
      type: String
    }
  },
  'Forms.FormRef': {
    Id: {
      identifier: true,
      label: "Id",
      type: String
    },
    InternalName: {
      label: "Internal Name",
      type: String
    },
    LoweredInternalName: {
      label: "Lowered Internal Name",
      type: String
    },
    LoweredUrlName: {
      label: "Lowered Url Name",
      type: String
    },
    Name: {
      label: "Name",
      required: true,
      type: String
    },
    Title: {
      label: "Title",
      type: String
    },
    UrlName: {
      label: "Url Name",
      type: String
    }
  },
  'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake': {
    $extends: "Forms.FormEntry",
    $format: "[Section1ClientInformation.FullName]",
    $id: "4",
    Section1ClientInformation: {
      init: function() { return {}; },
      label: "Section 1: Client Information",
      format: "Section 1: Client Information",
      set: function() { return core.ensureChildProperties(this, 'Section1ClientInformation', arguments); },
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section1ClientInformation'
    },
    Section2IDVerification: {
      init: function() { return {}; },
      label: "Section 2: ID Verification",
      format: "Section 2: ID Verification",
      set: function() { return core.ensureChildProperties(this, 'Section2IDVerification', arguments); },
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section2IDVerification'
    },
    Section3CreditProgramSelection: {
      init: function() { return {}; },
      label: "Section 3: Credit & Program Selection",
      format: "Section 3: Credit & Program Selection",
      set: function() { return core.ensureChildProperties(this, 'Section3CreditProgramSelection', arguments); },
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section3CreditProgramSelection'
    },
    Section4DownPaymentAssistance: {
      init: function() { return {}; },
      label: "Section 4: Down Payment Assistance",
      format: "Section 4: Down Payment Assistance",
      set: function() { return core.ensureChildProperties(this, 'Section4DownPaymentAssistance', arguments); },
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section4DownPaymentAssistance'
    },
    Section5ProcessDisclosure: {
      init: function() { return {}; },
      label: "Section 5: Process Disclosure",
      format: "Section 5: Process Disclosure",
      set: function() { return core.ensureChildProperties(this, 'Section5ProcessDisclosure', arguments); },
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section5ProcessDisclosure'
    },
    Section6CreditPurchaseRules: {
      init: function() { return {}; },
      label: "Section 6: Credit & Purchase Rules",
      format: "Section 6: Credit & Purchase Rules",
      set: function() { return core.ensureChildProperties(this, 'Section6CreditPurchaseRules', arguments); },
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section6CreditPurchaseRules'
    },
    Section7PaymentCommitment: {
      init: function() { return {}; },
      label: "Section 7: Payment & Commitment",
      format: "Section 7: Payment & Commitment",
      set: function() { return core.ensureChildProperties(this, 'Section7PaymentCommitment', arguments); },
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section7PaymentCommitment'
    },
    Section8CancellationFees: {
      init: function() { return {}; },
      label: "Section 8: Cancellation & Fees",
      format: "Section 8: Cancellation & Fees",
      set: function() { return core.ensureChildProperties(this, 'Section8CancellationFees', arguments); },
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section8CancellationFees'
    },
    Section9LegalDisclosure: {
      init: function() { return {}; },
      label: "Section 9: Legal Disclosure",
      format: "Section 9: Legal Disclosure",
      set: function() { return core.ensureChildProperties(this, 'Section9LegalDisclosure', arguments); },
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section9LegalDisclosure'
    },
    Section10Signature: {
      init: function() { return {}; },
      label: "Section 10: Signature",
      format: "Section 10: Signature",
      set: function() { return core.ensureChildProperties(this, 'Section10Signature', arguments); },
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section10Signature'
    },
    Id: {
      identifier: true,
      label: "Id",
      type: String
    },
    Entry: {
      init: function() { return {"FieldValues":null,"Number":null,"Version":0,"Status":"Incomplete","Timestamp":null,"DateCreated":null,"DateSubmitted":null,"DateUpdated":null,"PaymentToken":null,"CustomerCard":null,"Origin":null,"IsBeta":true,"Order":null,"LastPageViewed":null,"EditLink":null,"ViewLink":null,"AdminLink":null,"Action":null,"Role":null,"User":null}; },
      label: "Entry",
      type: 'Forms.EntryMeta.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake'
    },
    Order: {
      label: "Order",
      type: 'Payment.Order'
    },
    Entry_Statuses: {
      $transient: true,
      type: 'Object[]',
      constant: [
        {
          Id: 0,
          Name: "Incomplete",
          Color: "#d0dbdb"
        },
        {
          Id: 1,
          Name: "Under Review",
          Color: "#00B3AB"
        },
        {
          Id: 2,
          Name: "Awaiting Documents",
          Color: "#f9cf62"
        },
        {
          Id: 3,
          Name: "Payment Pending",
          Color: "#94cc3f"
        },
        {
          Id: 4,
          Name: "In Process",
          Color: "#b873d3"
        },
        {
          Id: 5,
          Name: "Completed",
          Color: "#d85427"
        },
        {
          Id: 6,
          Name: "Cancelled",
          Color: "#72a6d3"
        }
      ]
    },
    Form: {
      init: function() { return {"Id":"4","Name":"Grant & Co Consultants  Home Buying & Credit Readiness Intake","Title":null,"InternalName":"GrantCoConsultantsHomeBuyingCreditReadinessIntake","LoweredInternalName":"grantcoconsultantshomebuyingcreditreadinessintake","UrlName":null,"LoweredUrlName":"grantcoconsultantshomebuyingcreditreadinessintake"}; }
    },
    Form_Theme: {
      $transient: true,
      type: 'Object[]',
      constant: {
        Style: "Standard",
        Logo: {
          Id: "F-1FgOmShRp2KxI$xRcpIexk",
          Name: "853f1e15-3fbf-4f03-9501-9f8e7459a70d.png",
          ContentType: "image/png",
          Size: 125329,
          File_Name: "853f1e15-3fbf-4f03-9501-9f8e7459a70d"
        },
        HeaderAlignment: 1,
        Title: {
          FontFamily: "Times New Roman,Times,serif",
          FontSize: "1.5em",
          Color: "rgba(0, 0, 0, 1)",
          IsBold: true
        },
        HideHeading: true,
        HeaderBackgroundColor: "rgba(0, 0, 0, 0)",
        Heading: {
          FontFamily: "Times New Roman,Times,serif",
          FontSize: "1.25em",
          Color: "rgba(0, 0, 0, 1)",
          IsBold: true
        },
        Label: {
          FontFamily: "Times New Roman,Times,serif",
          FontSize: "0.875em",
          Color: "rgba(0, 0, 0, 1)",
          IsBold: true
        },
        Text: {
          FontFamily: "Times New Roman,Times,serif",
          FontSize: "0.8125em",
          Color: "rgba(0, 0, 0, 1)"
        },
        PlaceholderText: {
          FontFamily: "Arial,Helvetica,sans-serif",
          FontSize: "0.8125em",
          Color: "rgba(204, 204, 204, 1)"
        },
        Link: {
          FontFamily: "inherit",
          FontSize: "1em",
          Color: "rgba(194, 75, 35, 1)"
        },
        Button: {
          FontFamily: "Times New Roman,Times,serif",
          FontSize: "0.875em",
          Color: "rgba(255, 255, 255, 1)",
          BackgroundColor: "rgba(194, 75, 35, 1)"
        },
        HighlightColor: "rgba(26, 152, 255, 1)",
        FormBackgroundColor: "rgba(255,255,255,1)",
        PageBackgroundColor: "rgba(204,204,204,1)",
        PageBackgroundImage: {
          Id: "F-5dZAP3sZeIWBnb86qe1nLu",
          Name: "Untitled design-6.png",
          ContentType: "image/png",
          Size: 101759,
          File_Name: "Untitled design-6"
        },
        TilePageBackground: true
      }
    },
    Allow_Workflow_Links: {
      $transient: true,
      type: Boolean,
      constant: true
    },
    Form_Available: {
      $transient: true,
      type: Boolean,
      constant: true
    },
    Payment_Processor_Name: {
      $transient: true,
      type: String
    },
    Line_Item_Metadata: {
      $transient: true,
      type: 'Object[]',
      constant: []
    },
    Transaction_Fees: {
      $transient: true,
      type: 'Object[]',
      constant: []
    },
    Processing_Fees: {
      $transient: true,
      type: 'Object[]',
      constant: []
    },
    Processing_Fee_Description: {
      $transient: true,
      type: String
    },
    Domestic_Country_Code: {
      $transient: true,
      type: String
    },
    Application_Fee: {
      $transient: true,
      type: Object
    },
    European_Countries: {
      $transient: true,
      type: 'String[]'
    },
    Processor_Fee_Modes: {
      $transient: true,
      type: Object
    },
    rebuildOrder: {
      function: function() { return rebuildOrder(this, this.Order); },
      dependsOn: "Require_Payment,Order"
    },
    Save_Customer_Card: {
      $transient: true,
      type: Boolean,
      get: function() { return true; }
    },
    Require_Payment: {
      $transient: true,
      type: Boolean
    },
    Require_Payment_Expression: {
      $transient: true,
      type: Boolean,
      get: function() { return false; }
    },
    $storageProperties: {
      x2: "Section1ClientInformation",
      x3: "Section2IDVerification",
      x4: "Section3CreditProgramSelection",
      x5: "Section4DownPaymentAssistance",
      x6: "Section5ProcessDisclosure",
      x7: "Section6CreditPurchaseRules",
      x8: "Section7PaymentCommitment",
      x9: "Section8CancellationFees",
      x10: "Section9LegalDisclosure",
      x11: "Section10Signature",
      x14: "Order"
    }
  },
  'DynamicEntity': {
    Id: {
      label: "Id",
      type: String
    }
  },
  'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section1ClientInformation': {
    $extends: "DynamicEntity",
    FullName: {
      init: function() { return {}; },
      label: "Full Name",
      helptext: "Enter your full legal name as it appears on government ID.",
      required: {
        dependsOn: "{FullName.First,FullName.Last}",
        message: function() { return this.FullName.validateRequiredName(); }
      },
      format: "[First] [Last]",
      type: 'Name'
    },
    PhoneNumber: {
      label: "Phone Number",
      helptext: "Provide a number we can use to contact you about your home purchase.",
      required: true,
      format: {
        description: "###-###-#### x####",
        reformat: "($1) $2-$3$4",
        expression: /^\s*\(?([1-9][0-9][0-9])\)?[ -]?([0-9]{3})-?([0-9]{4})( ?x[0-9]{1,8})?\s*$/
      },
      type: String
    },
    EmailAddress: {
      label: "Email Address",
      helptext: "We will use this email for all communications and account setups.",
      required: true,
      format: {
        description: "name@address.xyz",
        reformat: "$1",
        expression: /^\s*([a-zA-Z0-9\!\#\$\%\&\'\*\+\-\/\=\?\^_\`\{\|\}\~]+(\.[a-zA-Z0-9\!\#\$\%\&\'\*\+\-\/\=\?\^_\`\{\|\}\~]+)*@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,64}|([0-9]{1,3}(\.[0-9]{1,3}){3})))\s*$/
      },
      type: String
    },
    DateOfBirth: {
      label: "Date of Birth",
      helptext: "Required for identity verification.",
      required: true,
      format: "d",
      type: Date
    },
    SocialSecurityNumber: {
      label: "Social Security Number ",
      helptext: "<p>Enter your full Social Security number.</p>",
      required: true,
      type: String
    },
    CurrentAddressFullAddressWithCityStateZip: {
      init: function() { return {"Country":this.meta.type.model.getResource("united-states"),"CountryCode":'US'}; },
      label: "Current Address (Full address with city, state, zip)",
      helptext: "Provide your current residential address including city, state, and postal code.",
      required: {
        dependsOn: "{CurrentAddressFullAddressWithCityStateZip.Line1,CurrentAddressFullAddressWithCityStateZip.City,CurrentAddressFullAddressWithCityStateZip.State,CurrentAddressFullAddressWithCityStateZip.PostalCode}",
        message: function() { return this.CurrentAddressFullAddressWithCityStateZip.validateRequiredAddress(['Line1','City','State','PostalCode']); }
      },
      error: {
        dependsOn: "{CurrentAddressFullAddressWithCityStateZip.PostalCode,CurrentAddressFullAddressWithCityStateZip.Country}",
        function: function() { return this.CurrentAddressFullAddressWithCityStateZip.validateZipCode(); }
      },
      format: "[FullAddress]",
      type: 'Address'
    },
    Form: {
      label: "Form",
      format: "[Section1ClientInformation.FullName]",
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake'
    },
    $storageProperties: {
      x3: "PhoneNumber",
      x4: "EmailAddress",
      x5: "DateOfBirth",
      x6: "SocialSecurityNumber",
      x2: "FullName",
      x7: "CurrentAddressFullAddressWithCityStateZip",
      x9: "Form"
    }
  },
  'Name': {
    $format: "[FirstAndLast]",
    First: {
      label: "First",
      type: String
    },
    FirstAndLast: {
      label: "First And Last",
      get: {
        dependsOn: "{First,Last}",
        function: function() { return ((str(this.First) + " ") + str(this.Last)); }
      },
      type: String
    },
    Last: {
      label: "Last",
      type: String
    },
    Middle: {
      label: "Middle",
      type: String
    },
    MiddleInitial: {
      label: "Middle Initial",
      type: String
    },
    Prefix: {
      label: "Prefix",
      type: String
    },
    Suffix: {
      label: "Suffix",
      type: String
    }
  },
  'Address': {
    City: {
      label: "City",
      type: String
    },
    CityStatePostalCode: {
      label: "City State Postal Code",
      get: {
        dependsOn: "{City,State,PostalCode}",
        function: function() { return [[this.City, this.State].filter(function(s) {return (!(String_isNullOrWhiteSpace(s))); }, this).join(", "), this.PostalCode].filter(function(s) {return (!(String_isNullOrWhiteSpace(s))); }, this).join(" "); }
      },
      type: String
    },
    Country: {
      label: "Country",
      type: String
    },
    CountryCode: {
      label: "Country Code",
      type: String
    },
    FullAddress: {
      label: "Full Address",
      get: {
        dependsOn: "{StreetAddress,CityStatePostalCode}",
        function: function() { return [this.StreetAddress, this.CityStatePostalCode].filter(function(s) {return (!(String_isNullOrWhiteSpace(s))); }, this).join(", "); }
      },
      type: String
    },
    FullInternationalAddress: {
      label: "Full International Address",
      get: {
        dependsOn: "{FullAddress,Country}",
        function: function() { return [this.FullAddress, this.Country].filter(function(s) {return (!(String_isNullOrWhiteSpace(s))); }, this).join(", "); }
      },
      type: String
    },
    Latitude: {
      label: "Latitude",
      default: null,
      format: "N2",
      type: Number
    },
    Line1: {
      label: "Address Line 1",
      type: String
    },
    Line2: {
      label: "Address Line 2",
      type: String
    },
    Line3: {
      label: "Address Line 3",
      type: String
    },
    Longitude: {
      label: "Longitude",
      default: null,
      format: "N2",
      type: Number
    },
    PostalCode: {
      label: "Postal Code",
      type: String
    },
    State: {
      label: "State",
      type: String
    },
    StreetAddress: {
      label: "Street Address",
      get: {
        dependsOn: "{Line1,Line2,Line3}",
        function: function() { return [this.Line1, this.Line2, this.Line3].filter(function(s) {return (!(String_isNullOrWhiteSpace(s))); }, this).join(", "); }
      },
      type: String
    },
    Type: {
      label: "Type",
      format: "[DisplayName]",
      type: 'AddressType'
    }
  },
  'AddressType': {
    $enum: [
      "Home",
      "Billing",
      "Mailing",
      "Business"
    ],
    $format: "[DisplayName]",
    Id: {
      identifier: true,
      label: "Id",
      type: Number
    },
    Name: {
      label: "Name",
      type: String
    },
    DisplayName: {
      label: "Display Name",
      type: String
    }
  },
  'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section2IDVerification': {
    $extends: "DynamicEntity",
    UploadDriversLicenseOrStateID: {
      label: "Upload Driver’s License or State ID",
      helptext: "Upload a clear, readable photo or scan of your government-issued ID (front and back if possible).",
      required: true,
      length: {
        max: 10
      },
      type: 'FileDataRef[]'
    },
    Form: {
      label: "Form",
      format: "[Section1ClientInformation.FullName]",
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake'
    },
    $storageProperties: {
      x2: "UploadDriversLicenseOrStateID",
      x4: "Form"
    }
  },
  'FileDataRef': {
    $format: "[Name]",
    CloudSyncRef: {
      label: "Cloud Sync Ref",
      type: String
    },
    ContentType: {
      label: "Content Type",
      type: String
    },
    ExternalFolderId: {
      label: "External Folder Id",
      type: String
    },
    Field_Name: {
      label: "Field_ Name",
      type: String
    },
    File_Name: {
      label: "File_ Name",
      type: String
    },
    Height: {
      label: "Height",
      default: null,
      format: "N0",
      type: Number
    },
    Id: {
      identifier: true,
      label: "Id",
      type: String
    },
    IsEncrypted: {
      label: "Is Encrypted",
      type: Boolean
    },
    Name: {
      label: "Name",
      type: String
    },
    Size: {
      label: "Size",
      format: "N0",
      type: Number
    },
    StorageUrl: {
      label: "Storage Url",
      type: String
    },
    Width: {
      label: "Width",
      default: null,
      format: "N0",
      type: Number
    }
  },
  'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section3CreditProgramSelection': {
    $extends: "DynamicEntity",
    AreYouIncludingCreditRepairWithYourHomePackage_Choices: {
      label: "Are you including Credit Repair with your Home Package? Choices",
      constant: [
        {
          Label: "Yes — Requires Credit Hero Score account"
        },
        {
          Label: "No — Requires MyFICO login upload"
        }
      ],
      set: function() { return core.ensureChildProperties(this, 'AreYouIncludingCreditRepairWithYourHomePackage_Choices', arguments); },
      type: 'Choice[]'
    },
    AreYouIncludingCreditRepairWithYourHomePackage: {
      label: "Are you including Credit Repair with your Home Package?",
      helptext: "Select Yes if you want credit repair included. Select No if you will provide MyFICO mortgage scores.",
      allowedValues: {
        ignoreValidation: true,
        preventInvalidValues: true,
        function: function() { return ["Yes — Requires Credit Hero Score account", "No — Requires MyFICO login upload"]; }
      },
      required: true,
      type: String
    },
    UploadScreenshotOrConfirmationOfCreditHeroScoreAccount: {
      label: "Upload screenshot or confirmation of Credit Hero Score account",
      helptext: "Required if you selected Yes above. Upload a screenshot or confirmation showing your Credit Hero Score account creation.",
      length: {
        max: 10
      },
      type: 'FileDataRef[]'
    },
    UploadMyFICOMortgageScoreScreenshot: {
      label: "Upload MyFICO mortgage score screenshot",
      helptext: "Required if you selected No above. Upload a screenshot of your MyFICO mortgage scores (must meet minimum qualifying score of 620).",
      length: {
        max: 10
      },
      type: 'FileDataRef[]'
    },
    Form: {
      label: "Form",
      format: "[Section1ClientInformation.FullName]",
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake'
    },
    $storageProperties: {
      x2: "AreYouIncludingCreditRepairWithYourHomePackage",
      x6: "AreYouIncludingCreditRepairWithYourHomePackage_Choices",
      x3: "UploadScreenshotOrConfirmationOfCreditHeroScoreAccount",
      x4: "UploadMyFICOMortgageScoreScreenshot",
      x7: "Form"
    }
  },
  'Choice': {
    $format: "[Label]",
    Image: {
      label: "Image",
      format: "[Name]",
      type: 'FileDataRef'
    },
    IsSelected: {
      label: "Is Selected",
      type: Boolean
    },
    Label: {
      label: "Label",
      type: String
    },
    Price: {
      label: "Price",
      default: null,
      format: "N2",
      type: Number
    },
    Quantity: {
      label: "Quantity",
      default: null,
      format: "N0",
      type: Number
    },
    Value: {
      label: "Value",
      default: null,
      format: "N2",
      type: Number
    }
  },
  'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section4DownPaymentAssistance': {
    $extends: "DynamicEntity",
    IAmInterestedInDownPaymentAssistance1800: {
      label: "I am interested in Down Payment Assistance (+$1,800)",
      helptext: "Checking this will add Down Payment Assistance to your package for an additional $1,800.",
      default: false,
      format: "Yes;No",
      type: Boolean
    },
    Form: {
      label: "Form",
      format: "[Section1ClientInformation.FullName]",
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake'
    },
    $storageProperties: {
      x2: "IAmInterestedInDownPaymentAssistance1800",
      x4: "Form"
    }
  },
  'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section5ProcessDisclosure': {
    $extends: "DynamicEntity",
    Form: {
      label: "Form",
      format: "[Section1ClientInformation.FullName]",
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake'
    },
    $storageProperties: {
      x3: "Form"
    }
  },
  'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section6CreditPurchaseRules': {
    $extends: "DynamicEntity",
    IAgreeNotToApplyForNewCreditDuringThisProcess: {
      label: "I agree not to apply for new credit during this process",
      default: false,
      required: {
        message: function() { if (this.get('IAgreeNotToApplyForNewCreditDuringThisProcess') !== true) return this.meta.type.model.getResource('required-value', { value: 'Yes' }); }
      },
      format: "Yes;No",
      type: Boolean
    },
    IAgreeNotToMakeLargePurchases: {
      label: "I agree not to make large purchases",
      default: false,
      required: {
        message: function() { if (this.get('IAgreeNotToMakeLargePurchases') !== true) return this.meta.type.model.getResource('required-value', { value: 'Yes' }); }
      },
      format: "Yes;No",
      type: Boolean
    },
    IAgreeNotToAddOrRemoveAccountsWithoutApproval: {
      label: "I agree not to add or remove accounts without approval",
      default: false,
      required: {
        message: function() { if (this.get('IAgreeNotToAddOrRemoveAccountsWithoutApproval') !== true) return this.meta.type.model.getResource('required-value', { value: 'Yes' }); }
      },
      format: "Yes;No",
      type: Boolean
    },
    IUnderstandThisMayNegativelyImpactMyApproval: {
      label: "I understand this may negatively impact my approval",
      helptext: "Acknowledges that changes to credit or accounts may negatively impact loan approval.",
      default: false,
      required: {
        message: function() { if (this.get('IUnderstandThisMayNegativelyImpactMyApproval') !== true) return this.meta.type.model.getResource('required-value', { value: 'Yes' }); }
      },
      format: "Yes;No",
      type: Boolean
    },
    Form: {
      label: "Form",
      format: "[Section1ClientInformation.FullName]",
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake'
    },
    $storageProperties: {
      x2: "IAgreeNotToApplyForNewCreditDuringThisProcess",
      x3: "IAgreeNotToMakeLargePurchases",
      x4: "IAgreeNotToAddOrRemoveAccountsWithoutApproval",
      x5: "IUnderstandThisMayNegativelyImpactMyApproval",
      x7: "Form"
    }
  },
  'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section7PaymentCommitment': {
    $extends: "DynamicEntity",
    IUnderstandThisIsANonrefundableServiceAndPaymentMustBeMadeBeforeServicesBegin: {
      label: "I understand this is a non-refundable service and payment must be made before services begin",
      helptext: "By checking, you acknowledge payment is non-refundable and required prior to service start.",
      default: false,
      required: {
        message: function() { if (this.get('IUnderstandThisIsANonrefundableServiceAndPaymentMustBeMadeBeforeServicesBegin') !== true) return this.meta.type.model.getResource('required-value', { value: 'Yes' }); }
      },
      format: "Yes;No",
      type: Boolean
    },
    IUnderstandServicesWillNotBeginUntilPaymentHasCleared: {
      label: "I understand services will not begin until payment has cleared",
      default: false,
      required: {
        message: function() { if (this.get('IUnderstandServicesWillNotBeginUntilPaymentHasCleared') !== true) return this.meta.type.model.getResource('required-value', { value: 'Yes' }); }
      },
      format: "Yes;No",
      type: Boolean
    },
    Form: {
      label: "Form",
      format: "[Section1ClientInformation.FullName]",
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake'
    },
    $storageProperties: {
      x2: "IUnderstandThisIsANonrefundableServiceAndPaymentMustBeMadeBeforeServicesBegin",
      x3: "IUnderstandServicesWillNotBeginUntilPaymentHasCleared",
      x8: "Form"
    }
  },
  'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section8CancellationFees': {
    $extends: "DynamicEntity",
    IUnderstandThatIfICancelAfterStartingThisProcessIWillIncurA1800CancellationFeePayableToTheRealtyCompany: {
      label: "I understand that if I cancel after starting this process, I will incur a $1,800 cancellation fee payable to the realty company",
      helptext: "<p>Acknowledges the $1,800 cancellation fee if you cancel after the process has started.</p>",
      default: false,
      required: {
        message: function() { if (this.get('IUnderstandThatIfICancelAfterStartingThisProcessIWillIncurA1800CancellationFeePayableToTheRealtyCompany') !== true) return this.meta.type.model.getResource('required-value', { value: 'Yes' }); }
      },
      format: "Yes;No",
      type: Boolean
    },
    IUnderstandThisIsNotAProcessWhereICanStartAndChangeMyMind: {
      label: "I understand this is not a process where I can start and change my mind",
      default: false,
      required: {
        message: function() { if (this.get('IUnderstandThisIsNotAProcessWhereICanStartAndChangeMyMind') !== true) return this.meta.type.model.getResource('required-value', { value: 'Yes' }); }
      },
      format: "Yes;No",
      type: Boolean
    },
    Form: {
      label: "Form",
      format: "[Section1ClientInformation.FullName]",
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake'
    },
    $storageProperties: {
      x2: "IUnderstandThatIfICancelAfterStartingThisProcessIWillIncurA1800CancellationFeePayableToTheRealtyCompany",
      x3: "IUnderstandThisIsNotAProcessWhereICanStartAndChangeMyMind",
      x5: "Form"
    }
  },
  'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section9LegalDisclosure': {
    $extends: "DynamicEntity",
    Form: {
      label: "Form",
      format: "[Section1ClientInformation.FullName]",
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake'
    },
    $storageProperties: {
      x3: "Form"
    }
  },
  'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Section10Signature': {
    $extends: "DynamicEntity",
    FullNameTypedSignature: {
      init: function() { return {}; },
      label: "Full Name (Typed Signature)",
      helptext: "Type your full legal name as your electronic signature.",
      required: {
        dependsOn: "{FullNameTypedSignature.First,FullNameTypedSignature.Last}",
        message: function() { return this.FullNameTypedSignature.validateRequiredName(); }
      },
      format: "[First] [Last]",
      type: 'Name'
    },
    SignatureDrawn: {
      init: function() { return {}; },
      label: "Signature (Drawn)",
      helptext: "Draw your signature in the signature field.",
      required: {
        dependsOn: "{SignatureDrawn.Svg}",
        message: function() { return this.SignatureDrawn.validateRequiredSignature(); }
      },
      format: "[Png]",
      type: 'Signature'
    },
    DateAuto: {
      label: "Date (Auto)",
      helptext: "This date will be auto-populated with the date you sign.",
      required: true,
      format: "d",
      type: Date
    },
    IAgreeToAllTermsAndAuthorizeGrantCoConsultantsToProceed: {
      label: "I agree to all terms and authorize Grant & Co Consultants to proceed",
      default: false,
      required: {
        message: function() { if (this.get('IAgreeToAllTermsAndAuthorizeGrantCoConsultantsToProceed') !== true) return this.meta.type.model.getResource('required-value', { value: 'Yes' }); }
      },
      format: "Yes;No",
      type: Boolean
    },
    Form: {
      label: "Form",
      format: "[Section1ClientInformation.FullName]",
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake'
    },
    $storageProperties: {
      x4: "DateAuto",
      x5: "IAgreeToAllTermsAndAuthorizeGrantCoConsultantsToProceed",
      x2: "FullNameTypedSignature",
      x3: "SignatureDrawn",
      x8: "Form"
    }
  },
  'Signature': {
    $format: "[Png]",
    Png: {
      label: "Png",
      type: String
    },
    PngFile: {
      label: "Png File",
      format: "[Name]",
      type: 'FileDataRef'
    },
    Svg: {
      label: "Svg",
      type: String
    },
    SvgFile: {
      label: "Svg File",
      format: "[Name]",
      type: 'FileDataRef'
    },
    TypedText: {
      label: "Typed Text",
      type: String
    }
  },
  'Forms.EntryMeta.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake': {
    $extends: "Forms.EntryMeta",
    Action: {
      label: "Action",
      type: String
    },
    Role: {
      label: "Role",
      type: String
    },
    Status: {
      label: "Status",
      type: String
    },
    ApplicantLink: {
      label: "ApplicantLink",
      type: String
    },
    GrantCoAdminLink: {
      label: "GrantCoAdminLink",
      type: String
    },
    LoanCoordinatorLink: {
      label: "LoanCoordinatorLink",
      type: String
    }
  },
  'Payment.Order': {
    AdditionalFees: {
      label: "Additional Fees",
      format: "C",
      type: Number
    },
    AmountDeclined: {
      label: "Amount Declined",
      default: null,
      format: "C",
      type: Number
    },
    AmountDue: {
      label: "Amount Due",
      format: "C",
      type: Number
    },
    AmountPaid: {
      label: "Amount Paid",
      format: "C",
      type: Number
    },
    ApplicationFee: {
      label: "Application Fee",
      type: 'Payment.TransactionFee'
    },
    ApplicationFeeAmount: {
      label: "Application Fee Amount",
      default: null,
      format: "C",
      type: Number
    },
    BillingAddress: {
      label: "Billing Address",
      format: "[FullAddress]",
      type: 'Address'
    },
    BillingName: {
      label: "Billing Name",
      format: "[FirstAndLast]",
      type: 'Name'
    },
    Currency: {
      label: "Currency",
      format: "[DisplayName]",
      type: 'Currency'
    },
    Date: {
      label: "Date",
      default: null,
      format: "g",
      type: Date
    },
    Description: {
      label: "Description",
      type: String
    },
    EmailAddress: {
      label: "Email Address",
      format: {
        description: "name@address.xyz",
        reformat: "$1",
        expression: /^\s*([a-zA-Z0-9\!\#\$\%\&\'\*\+\-\/\=\?\^_\`\{\|\}\~]+(\.[a-zA-Z0-9\!\#\$\%\&\'\*\+\-\/\=\?\^_\`\{\|\}\~]+)*@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,64}|([0-9]{1,3}(\.[0-9]{1,3}){3})))\s*$/
      },
      type: String
    },
    Encrypt: {
      label: "Encrypt",
      type: Boolean
    },
    Fees: {
      label: "Fees",
      type: 'Payment.Fee[]'
    },
    FormURL: {
      label: "Form URL",
      type: String
    },
    Id: {
      identifier: true,
      label: "Id",
      type: String
    },
    IsDeleted: {
      label: "Is Deleted",
      type: Boolean
    },
    IsOpen: {
      label: "Is Open",
      type: Boolean
    },
    LineItemGroups: {
      label: "Line Item Groups",
      type: 'Payment.LineItemGroup[]'
    },
    LineItems: {
      label: "Line Items",
      type: 'Payment.LineItem[]'
    },
    MethodReference: {
      label: "Method Reference",
      type: String
    },
    MethodReferenceNumber: {
      label: "Method Reference Number",
      type: String
    },
    Module: {
      label: "Module",
      type: 'ModuleRef'
    },
    OrderAmount: {
      label: "Order Amount",
      format: "C",
      type: Number
    },
    OrderId: {
      label: "Order Id",
      type: String
    },
    OrderItems: {
      label: "Order Items",
      type: 'Payment.OrderItem[]'
    },
    OrderSummary: {
      label: "Order Summary",
      type: String
    },
    PaymentAccountStatus: {
      label: "Payment Account Status",
      format: "[DisplayName]",
      type: 'Payment.PaymentAccountStatus'
    },
    PaymentConfirmationNumber: {
      label: "Payment Confirmation Number",
      type: String
    },
    PaymentDate: {
      label: "Payment Date",
      default: null,
      format: "g",
      type: Date
    },
    PaymentMessage: {
      label: "Payment Message",
      type: String
    },
    PaymentMethod: {
      label: "Payment Method",
      format: "[DisplayName]",
      type: 'Payment.PaymentMethod'
    },
    PaymentReferenceUrl: {
      label: "Payment Reference Url",
      format: {
        description: "http://domainname",
        expression: /^https?:\/\/[\da-z\.-]+\.[a-z\.]{2,6}[\/\w \.-]*$/
      },
      type: String
    },
    Payments: {
      label: "Payments",
      type: 'Payment.PaymentRef[]'
    },
    PaymentStatus: {
      label: "Payment Status",
      format: "[DisplayName]",
      type: 'Payment.PaymentStatus'
    },
    PhoneNumber: {
      label: "Phone Number",
      type: String
    },
    ProcessingFees: {
      label: "Processing Fees",
      format: "C",
      type: Number
    },
    ProcessorFeeAmount: {
      label: "Processor Fee Amount",
      default: null,
      format: "C",
      type: Number
    },
    ProcessorName: {
      label: "Processor Name",
      type: String
    },
    RefundAmount: {
      label: "Refund Amount",
      default: null,
      format: "C",
      type: Number
    },
    RefundDate: {
      label: "Refund Date",
      default: null,
      format: "g",
      type: Date
    },
    ShippingAddress: {
      label: "Shipping Address",
      format: "[FullAddress]",
      type: 'Address'
    },
    SubmissionFailure: {
      label: "Submission Failure",
      type: String
    },
    SubTotal: {
      label: "Sub Total",
      format: "C",
      type: Number
    },
    Supersedes: {
      label: "Supersedes",
      type: 'Payment.OrderRef'
    }
  },
  'Payment.TransactionFee': {
    Description: {
      label: "Description",
      type: String
    },
    FixedAmount: {
      label: "Fixed Amount",
      default: null,
      format: "C",
      type: Number
    },
    PercentageAmount: {
      label: "Percentage Amount",
      default: null,
      format: "P2",
      type: Number
    },
    Terms: {
      label: "Terms",
      type: String
    }
  },
  'Lookup': {
    Code: {
      label: "Code",
      type: String
    },
    DisplayName: {
      label: "Display Name",
      type: String
    },
    Name: {
      label: "Name",
      type: String
    }
  },
  'Currency': {
    $extends: "Lookup",
    $format: "[DisplayName]",
    Id: {
      label: "Id",
      type: String
    },
    NumberOfDecimals: {
      label: "Number Of Decimals",
      format: "N0",
      type: Number
    },
    Symbol: {
      label: "Symbol",
      type: String
    }
  },
  'Payment.Fee': {
    Amount: {
      label: "Amount",
      format: "C",
      type: Number
    },
    Description: {
      label: "Description",
      type: String
    },
    IsProcessingFee: {
      label: "Is Processing Fee",
      type: Boolean
    },
    Name: {
      label: "Name",
      type: String
    }
  },
  'Payment.LineItemGroup': {
    LineItems: {
      label: "Line Items",
      type: 'Payment.LineItem[]'
    },
    Name: {
      label: "Name",
      type: String
    }
  },
  'Payment.LineItem': {
    Amount: {
      label: "Amount",
      format: "C",
      type: Number
    },
    Description: {
      label: "Description",
      type: String
    },
    Group: {
      label: "Group",
      type: String
    },
    Name: {
      label: "Name",
      type: String
    }
  },
  'ModuleRef': {
    Code: {
      label: "Code",
      type: String
    },
    Id: {
      identifier: true,
      label: "Id",
      type: String
    },
    Name: {
      label: "Name",
      type: String
    }
  },
  'Payment.OrderItem': {
    Amount: {
      label: "Amount",
      format: "C",
      type: Number
    },
    Description: {
      label: "Description",
      type: String
    },
    Group: {
      label: "Group",
      type: String
    },
    Type: {
      label: "Type",
      format: "[DisplayName]",
      type: 'Payment.OrderItemType'
    },
    Variant: {
      label: "Variant",
      type: String
    }
  },
  'Payment.OrderItemType': {
    $enum: [
      "Product",
      "TransactionFee",
      "ProcessingFee"
    ],
    $format: "[DisplayName]",
    Id: {
      identifier: true,
      label: "Id",
      type: Number
    },
    Name: {
      label: "Name",
      type: String
    },
    DisplayName: {
      label: "Display Name",
      type: String
    }
  },
  'Payment.PaymentAccountStatus': {
    $enum: [
      "Active",
      "Inactive",
      "Warning",
      "UnavailableFeature",
      "Onboarding",
      "PendingVerification"
    ],
    $format: "[DisplayName]",
    Id: {
      identifier: true,
      label: "Id",
      type: Number
    },
    Name: {
      label: "Name",
      type: String
    },
    DisplayName: {
      label: "Display Name",
      type: String
    }
  },
  'Payment.PaymentMethod': {
    $enum: [
      "None",
      "Manual",
      "Visa",
      "MasterCard",
      "Discover",
      "AmericanExpress",
      "ECheck",
      "JCB",
      "DinersClub",
      "Unknown",
      "Bitcoin",
      "PayPal",
      "ACH",
      "ChinaUnionPay",
      "Venmo"
    ],
    $format: "[DisplayName]",
    Id: {
      identifier: true,
      label: "Id",
      type: Number
    },
    Name: {
      label: "Name",
      type: String
    },
    DisplayName: {
      label: "Display Name",
      type: String
    }
  },
  'Payment.PaymentRef': {
    Date: {
      label: "Date",
      default: null,
      format: "g",
      type: Date
    },
    Id: {
      identifier: true,
      label: "Id",
      type: String
    },
    ProcessorName: {
      label: "Processor Name",
      type: String
    }
  },
  'Forms.WorkflowAction': {
    ActionName: {
      label: "Action Name",
      type: String
    },
    AllowedWhen: {
      label: "Allowed When",
      type: String
    },
    ButtonText: {
      label: "Button Text",
      type: String
    },
    Confirmation: {
      label: "Confirmation",
      type: 'Forms.WorkflowActionConfirmation'
    },
    Emails: {
      label: "Emails",
      type: 'Forms.EntryEmailNotification[]'
    },
    FieldsToClear: {
      label: "Fields To Clear",
      type: 'String[]'
    },
    Id: {
      label: "Id",
      format: "N0",
      type: Number
    },
    IsArchived: {
      label: "Is Archived",
      type: Boolean
    },
    NewStatus: {
      label: "New Status",
      default: null,
      format: "N0",
      type: Number
    },
    PrefillConfigs: {
      label: "Prefill Configs",
      type: 'Forms.WorkflowActionPrefillConfiguration[]'
    },
    IsAllowed: {
      $transient: true,
      type: Boolean
    }
  },
  'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Form.Actions.Action0': {
    $extends: "Forms.WorkflowAction",
    Form: {
      $transient: true,
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake'
    },
    IsAllowed: {
      $transient: true,
      type: Boolean,
      get: {
        dependsOn: "Form.Entry{Status,Role}",
        function: function() { return (function() { return ((this.Entry.Status === "Incomplete") && (this.Entry.Role === "Applicant")); }).call(this.Form); }
      }
    },
    $data: {
      Id: 0,
      ActionName: "Submit Application",
      AllowedWhen: "=(Entry.Status = \"Incomplete\") and (Entry.Role = \"Applicant\")",
      ButtonText: "Submit Application",
      NewStatus: 1,
      IsArchived: false,
      Confirmation: {
        Behavior: "ConfirmationPage",
        Message: "Thank you for filling out the form. Your response has been recorded.",
        IncludeEntryDetails: false,
        IncludedDocuments: [],
        RedirectUrl: null
      }
    }
  },
  'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake.Form.Actions.Action6': {
    $extends: "Forms.WorkflowAction",
    Form: {
      $transient: true,
      type: 'Forms.FormEntry.GrantCoConsultants.GrantCoConsultantsHomeBuyingCreditReadinessIntake'
    },
    IsAllowed: {
      $transient: true,
      type: Boolean,
      get: {
        dependsOn: "Form.Entry{Status,Role}",
        function: function() { return (function() { return ((((this.Entry.Status === "Incomplete")||(this.Entry.Status === "Under Review")||(this.Entry.Status === "Awaiting Documents")||(this.Entry.Status === "Payment Pending")) && (this.Entry.Role === "Applicant")) || (((this.Entry.Status === "Incomplete")||(this.Entry.Status === "Under Review")||(this.Entry.Status === "Awaiting Documents")||(this.Entry.Status === "Payment Pending")||(this.Entry.Status === "In Process")) && ((this.Entry.Role === "Grant \u0026 Co Admin") || (this.Entry.Role === "Loan Coordinator")))); }).call(this.Form); }
      }
    },
    $data: {
      Id: 6,
      ActionName: "Cancel",
      AllowedWhen: "=(Entry.Status = \"Incomplete\" or Entry.Status = \"Under Review\" or Entry.Status = \"Awaiting Documents\" or Entry.Status = \"Payment Pending\") and (Entry.Role = \"Applicant\") or (Entry.Status = \"Incomplete\" or Entry.Status = \"Under Review\" or Entry.Status = \"Awaiting Documents\" or Entry.Status = \"Payment Pending\" or Entry.Status = \"In Process\") and (Entry.Role = \"Grant & Co Admin\" or Entry.Role = \"Loan Coordinator\")",
      ButtonText: "Cancel",
      NewStatus: 6,
      IsArchived: false,
      Confirmation: {
        Behavior: "ConfirmationPage",
        Message: "Thank you for filling out the form. Your response has been recorded.",
        IncludeEntryDetails: false,
        IncludedDocuments: [],
        RedirectUrl: null
      }
    }
  },
  'Forms.WorkflowActionConfirmation': {
    Behavior: {
      label: "Behavior",
      format: "[DisplayName]",
      type: 'Forms.ConfirmationBehavior'
    },
    IncludedDocuments: {
      label: "Included Documents",
      type: 'Number[]'
    },
    IncludeEntryDetails: {
      label: "Include Entry Details",
      type: Boolean
    },
    Message: {
      label: "Message",
      type: String
    },
    RedirectUrl: {
      label: "Redirect Url",
      type: String
    }
  },
  'Forms.ConfirmationBehavior': {
    $enum: [
      "ConfirmationPage",
      "RedirectURL"
    ],
    $format: "[DisplayName]",
    Id: {
      identifier: true,
      label: "Id",
      type: Number
    },
    Name: {
      label: "Name",
      type: String
    },
    DisplayName: {
      label: "Display Name",
      type: String
    }
  },
  'Notification': {
    $abstract: true,
    IncludedDocuments: {
      label: "Included Documents",
      type: 'Number[]'
    },
    IncludeDocumentAttachments: {
      label: "Include Document Attachments",
      type: Boolean
    }
  },
  'EmailNotification': {
    $extends: "Notification",
    Body: {
      label: "Body",
      type: String
    },
    Recipients: {
      label: "Recipients",
      type: 'NotificationAddress[]'
    },
    ReplyTo: {
      label: "Reply To",
      format: "[Address]",
      type: 'NotificationAddress'
    },
    Sender: {
      label: "Sender",
      format: "[Address]",
      type: 'NotificationAddress'
    },
    SendReceipt: {
      label: "Send Receipt",
      type: String
    },
    Subject: {
      label: "Subject",
      type: String
    }
  },
  'NotificationAddress': {
    $format: "[Address]",
    Address: {
      label: "Address",
      type: String
    },
    DeliveryStatus: {
      label: "Delivery Status",
      type: 'EmailDeliveryStatus'
    },
    DisplayName: {
      label: "Display Name",
      type: String
    },
    SendReceipt: {
      label: "Send Receipt",
      type: String
    }
  },
  'EmailDeliveryStatus': {
    Code: {
      label: "Code",
      format: "[DisplayName]",
      type: 'EmailStatusCode'
    },
    Description: {
      label: "Description",
      type: String
    },
    IsTerminal: {
      label: "Is Terminal",
      type: Boolean
    },
    RawStatus: {
      label: "Raw Status",
      type: String
    },
    Timestamp: {
      label: "Timestamp",
      format: "g",
      type: Date
    }
  },
  'EmailStatusCode': {
    $enum: [
      "Unsent",
      "Sent",
      "Delivered",
      "Bounced",
      "Rejected",
      "Spam",
      "Unknown",
      "Invalid",
      "SoftBounced"
    ],
    $format: "[DisplayName]",
    Id: {
      identifier: true,
      label: "Id",
      type: Number
    },
    Name: {
      label: "Name",
      type: String
    },
    DisplayName: {
      label: "Display Name",
      type: String
    }
  },
  'Forms.EntryEmailNotification': {
    $extends: "EmailNotification",
    DaysToLinkExpiration: {
      label: "Days To Link Expiration",
      default: null,
      format: "N0",
      type: Number
    },
    Id: {
      label: "Id",
      type: String
    },
    IncludeAttachments: {
      label: "Include Attachments",
      type: Boolean
    },
    IncludeBlankFields: {
      label: "Include Blank Fields",
      type: Boolean
    },
    IncludeEditLink: {
      label: "Include Edit Link",
      type: Boolean
    },
    IncludeEntryDetails: {
      label: "Include Entry Details",
      type: Boolean
    },
    IncludeFormLogo: {
      label: "Include Form Logo",
      type: Boolean
    },
    IncludeFormName: {
      label: "Include Form Name",
      type: Boolean
    },
    IncludeOrgName: {
      label: "Include Org Name",
      type: Boolean
    },
    IncludeReceipt: {
      label: "Include Receipt",
      type: Boolean
    },
    IncludeSenderName: {
      label: "Include Sender Name",
      type: Boolean
    },
    IncludeViewLink: {
      label: "Include View Link",
      type: Boolean
    },
    OnlySendOnChange: {
      label: "Only Send On Change",
      type: Boolean
    },
    RoleAssignment: {
      label: "Role Assignment",
      default: null,
      format: "N0",
      type: Number
    },
    SendWhen: {
      label: "Send When",
      type: String
    },
    SendWhenSubmitted: {
      label: "Send When Submitted",
      type: String
    },
    SendWhenUpdated: {
      label: "Send When Updated",
      type: String
    },
    Type: {
      label: "Type",
      format: "[DisplayName]",
      type: 'Forms.EmailNotificationType'
    },
    WorkflowLinkButtonText: {
      label: "Workflow Link Button Text",
      type: String
    }
  },
  'Forms.EmailNotificationType': {
    $enum: [
      "Notification",
      "Confirmation",
      "SaveAndResume",
      "SharedEntry",
      "Workflow",
      "Reminder"
    ],
    $format: "[DisplayName]",
    Id: {
      identifier: true,
      label: "Id",
      type: Number
    },
    Name: {
      label: "Name",
      type: String
    },
    DisplayName: {
      label: "Display Name",
      type: String
    }
  },
  'Forms.WorkflowActionPrefillConfiguration': {
    FieldMappings: {
      label: "Field Mappings",
      type: 'Forms.FieldMapping[]'
    },
    TargetActionId: {
      label: "Target Action Id",
      format: "N0",
      type: Number
    },
    TargetFormInfo: {
      label: "Target Form Info",
      type: 'Forms.TargetFormInfo'
    }
  },
  'Forms.FieldMapping': {
    SourceFieldIdPath: {
      label: "Source Field Id Path",
      type: String
    },
    TargetFieldIdPath: {
      label: "Target Field Id Path",
      type: String
    }
  },
  'Forms.TargetFormInfo': {
    TargetFormId: {
      label: "Target Form Id",
      type: String
    },
    TargetFormName: {
      label: "Target Form Name",
      type: String
    }
  }
};
var rebuildOrder = getModule('order-builder').then(function(module) { rebuildOrder = module.rebuildOrder; });
function str (o) { if (o === undefined || o === null) return ""; return o.toString(); }
function String_isNullOrWhiteSpace(s) { return s === null || s === undefined || !!s.match(/^\s*$/); }
return options;
})
,
	{ isChameleon: false, css: ".cog-4{--background-hsl: 0, 0%, 80%;--border-radius: 0px;--border-width: 1px;--color: rgba(0, 0, 0, 1);--font-family: Times New Roman,Times,serif;--font-size: 13px;--font-weight: normal;--gutter: 25px;--highlight: hsl(206,100%,55%);--highlight-reverse: hsl(0,0%,100%);--icon-weight: .9;--line-height: 1.4;--negative: hsl(2, 70%, 47%);--negative-reverse: white;--primary: rgba(194, 75, 35, 1);--primary-reverse: rgba(255, 255, 255, 1);--small-text: .85em;--speed: 1s;--a__color: rgba(194, 75, 35, 1);--a__font-family: inherit;--a__font-size: 1.23em;--a__font-weight: normal;--checkable__border-color: #bbb;--checkbox__border-radius: calc(var(--input__border-radius) * .2);--checkable__scale: 1;--checkable-checked__scale: 1.1;--button-primary__background-color: rgba(194, 75, 35, 1);--button-primary__border-color: rgba(194, 75, 35, 1);--button-primary__border-width: var(--border-width);--button-primary__border-radius: calc(var(--border-radius) + 3px);--button-primary__color: rgba(255, 255, 255, 1);--button-primary__font-family: Times New Roman,Times,serif;--button-primary__font-size: 1.08em;--button-primary__font-weight: normal;--button-secondary__background-color: rgba(255, 255, 255, 1);--button-secondary__border-color: rgba(194, 75, 35, 1);--button-secondary__border-radius: calc(var(--border-radius) + 3px);--button-secondary__border-width: var(--border-width);--button-secondary__color: rgba(194, 75, 35, 1);--button-secondary__font-family: Times New Roman,Times,serif;--button-secondary__font-size: 1.08em;--button-secondary__font-weight: normal;--form__background-color: rgba(255,255,255,1);--form__margins: 0px;--form__margins--responsive: 0px;--form__opacity: 1;--form__width: 800px;--h2__font-size: 1.54em;--header__background-color: rgba(0, 0, 0, 0);--header__padding-bottom: 0;--header__color: rgba(0, 0, 0, 1);--header__font-family: Times New Roman,Times,serif;--header__font-size: 1.85em;--header__font-weight: bold;--heading__base-size: 1.54em;--heading__color: rgba(0, 0, 0, 1);--heading__font-family: Times New Roman,Times,serif;--heading__font-size: 1.54em;--heading__font-weight: bold;--input__background-color: white;--input__border-color: hsl(0,0%,80%);--input__border-radius: calc(var(--border-radius) * .75);--input__border-style: solid;--input__border-width: var(--border-width);--input__box-shadow: none;--input__color: #333;--input__line-height: calc(var(--line-height) - .1);--input__padding-h: 10px;--input__padding-v: 8px;--input-focus__box-shadow: 0 0 1px 2px var(--input__background-color);--card__border-color: hsl(0,0%,80%);--label__color: rgba(0, 0, 0, 1);--label__font-family: Times New Roman,Times,serif;--label__font-size: 1.08em;--label__font-weight: bold;--page__background-color: rgba(204,204,204,1);--page__background-image: url(https://www.cognitoforms.com/file/XcRdbx9Kg9ciGQDduw7U7vlqddAlvac5So7cz17CZzmu67hE4geohrjlSV3EpoqH);--page__background-size: initial;--page__margins: 40px auto auto;--placeholder__color: rgba(204, 204, 204, 1);--toggle__border-radius: var(--input__border-radius);--input-highlight: var(--highlight);--input-highlight-reverse: transparent;--input__border-radius: 2px;}", links: [] || [] },
	null
);