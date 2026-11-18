/**
 * Backend API messages, returned in the response envelope's `message` and
 * `errors[].message` fields. Resolved per request from `Accept-Language`.
 *
 * English is the source of truth; `id` mirrors this key set exactly (enforced
 * by `locale-parity.test.ts`).
 *
 * Keys are flat and dot-notated: `{domain}.{message}`. Success acknowledgements
 * (`OK`, `Created`, …) are protocol tokens, not prose, and stay untranslated.
 */
const api = {
	'common.validationFailed': 'Validation failed',
	'common.notFound': 'Not found',
	'common.conflict': 'Conflict',
	'common.unsupportedMediaType': 'Unsupported media type',
	'common.imageInvalid': 'Upload a PNG, JPG, WebP or HEIC image of at most {{max}} MB',
	'common.fileInvalid': 'Upload a PDF, PNG, JPG or WebP file of at most {{max}} MB',
	'common.payloadTooLarge': 'Payload too large',
	'common.authenticationRequired': 'Authentication required',

	'location.provinceNotFound': 'Province not found',
	'location.regencyNotFound': 'Regency not found',
	'location.districtNotFound': 'District not found',
	'location.villageNotFound': 'Village not found',

	'sales.quotationNotFound': 'Quotation not found',
	'sales.paymentNotFound': 'Payment not found',
	'procurement.supplierNotFound': 'Supplier not found',
	'procurement.supplierCodeTaken': 'Supplier code {{code}} is already used',
	'procurement.supplierAlreadyActive': 'The supplier is already active',
	'procurement.supplierAlreadyInactive': 'The supplier is already inactive',
	'procurement.villageNotFound': 'Village (kelurahan/desa) not found',
	'procurement.purchaseRequestNotFound': 'Purchase request not found',
	'procurement.prState.notDraft': 'Only a draft purchase request can be changed or submitted',
	'procurement.prState.notSubmitted': 'Only a submitted purchase request can be approved or rejected',
	'procurement.prState.notCancellable': 'This purchase request can no longer be cancelled (a line is already on a purchase order)',
	'procurement.prNotOwner': 'Only the requester can change this purchase request',
	'procurement.prSelfApproval': 'You cannot approve or reject your own purchase request',
	'procurement.prCodeTaken': 'PR number {{code}} is already used',
	'procurement.prLineUnavailable': 'Line {{line}}: the purchase request line is not open for ordering',
	'procurement.purchaseOrderNotFound': 'Purchase order not found',
	'procurement.supplierUnavailable': 'Supplier not found or inactive',
	'procurement.itemUnavailable': 'Line {{line}}: item not found or inactive',
	'procurement.poState.notDraft': 'Only a draft purchase order can be changed or submitted',
	'procurement.poState.notSubmitted': 'The purchase order is not waiting for approval',
	'procurement.poState.notApproved': 'Only an approved purchase order can be marked as sent',
	'procurement.poState.notCancellable': 'This purchase order can no longer be cancelled',
	'procurement.poState.received': 'Goods were already received; the purchase order cannot be cancelled',
	'procurement.selfApproval': 'You cannot approve or reject your own purchase order',
	'procurement.poCodeTaken': 'PO number {{code}} is already used',
	'procurement.receiptBin': 'The storage does not belong to the chosen warehouse',
	'procurement.goodsReceiptNotFound': 'Goods receipt not found',
	'procurement.orderNotReceivable': 'Only a sent or partly received purchase order can be received',
	'procurement.receiptLine.unknown': 'Line {{line}}: not a line of this purchase order',
	'procurement.receiptLine.over': 'Line {{line}}: more than is still open on the purchase order',
	'procurement.receiptLine.serials': 'Line {{line}}: enter one unique serial number per unit',
	'sales.orderBilled': 'This sales order has invoices; void them before cancelling',
	'sales.deliveryNoteNotFound': 'Delivery note not found',
	'sales.deliveryOrderNotDeliverable': 'Only a confirmed or in-progress sales order can be delivered',
	'sales.deliveryLine.unknown': 'Line {{line}}: not a line of this sales order',
	'sales.deliveryLine.over': 'Line {{line}}: more than is still open on the sales order',
	'sales.deliveryLine.serials': 'Line {{line}}: enter one unique serial number per unit',
	'sales.deliveryLine.notInStock': 'Line {{line}}: a serial number is not in stock in this warehouse',
	'sales.deliveryBin': 'The storage does not belong to the chosen warehouse',
	'sales.deliveryState.ship': 'Only a prepared delivery note can be shipped',
	'sales.deliveryState.deliver': 'Only a shipped delivery note can be marked delivered',
	'sales.deliveryState.cancel': 'Only a prepared delivery note can be cancelled',
	'sales.orderDelivered': 'This sales order has delivery notes; cancel them before cancelling the order',
	'sales.deliveryReadForbidden': 'You may not read delivery notes',
	'projects.notFound': 'Project not found',
	'projects.notActive': 'The project is closed or cancelled',
	'projects.deal.notFound': 'Active sales order not found',
	'projects.deal.taken': 'This deal already has a project',
	'projects.staff.pic': 'The PIC must be a member who can manage projects',
	'projects.staff.assignee': 'Tasks can only go to members who can work on tasks',
	'projects.dates': 'The target end date is before the start date',
	'projects.evidenceMissing': 'Closing needs evidence: {{missing}}',
	'projects.childNotFound.task': 'Task not found in this project',
	'projects.childNotFound.evidence': 'Evidence file not found in this project',
	'projects.childNotFound.cost': 'Cost not found in this project',
	'projects.forbidden.task': 'Only the assignee or a project manager can update this task',
	'projects.forbidden.evidence': 'Only the uploader or a project manager can remove this file',
	'projects.file.type': 'Use a JPG, PNG, WebP or PDF file',
	'projects.file.size': 'Each file must be 15 MB or smaller',
	'projects.file.empty': 'The file is empty',
	'projects.costVoided': 'This cost is already voided',
	'sales.orderHasProject': 'This sales order has a project; cancel the project first',
	'projects.bastNotFound': 'BAST not found in this project',
	'aftersales.warrantyBastRequired': 'Pick an issued BAST of this project: the warranty starts at its date',
	'aftersales.warrantyProjectCancelled': 'The project is cancelled',
	'aftersales.warrantyExists': 'This project already has a warranty certificate',
	'aftersales.ticketNotFound': 'Service ticket not found',
	'aftersales.ticketRef.customer': 'The customer is missing or inactive',
	'aftersales.ticketRef.project': 'The project does not belong to this customer',
	'aftersales.ticketRef.serial': 'This serial number was delivered to another customer',
	'aftersales.ticketState.assign': 'Only a new or in-progress ticket can be assigned',
	'aftersales.ticketState.start': 'Only a new ticket can be started',
	'aftersales.ticketState.resolve': 'Only a new or in-progress ticket can be resolved',
	'aftersales.ticketState.reopen': 'Only a resolved ticket can be reopened',
	'aftersales.ticketState.close': 'Only a resolved ticket can be closed',
	'aftersales.ticketForbidden': 'Only the assignee or a ticket manager can work this ticket',
	'aftersales.ticketAssignee': 'Tickets can only go to members who can work on tickets',
	'sales.orderNotFound': 'Sales order not found',
	'sales.orderQuotationNotReady': 'Only an approved or sent quotation can become a sales order',
	'sales.orderExists': 'This quotation already has a sales order',
	'sales.orderNotCancellable': 'Only a confirmed sales order can be cancelled',
	'sales.customerUnavailable': 'Customer not found or inactive',
	'sales.contactInvalid': 'The contact does not belong to this customer',
	'sales.leadNotFound': 'Lead not found',
	'sales.itemUnavailable': 'Line {{line}}: item not found or inactive',
	'sales.discountTooLarge': 'Line {{line}}: the discount exceeds the line amount',
	'sales.quotationState.notDraft': 'Only a draft quotation can be changed or submitted',
	'sales.quotationState.notSubmitted': 'The quotation is not waiting for approval',
	'sales.quotationState.notApproved': 'Only an approved quotation can be marked as sent',
	'sales.quotationState.notOpen': 'Only an open quotation can be marked as lost',
	'sales.quotationState.revisionOfDraft': 'A draft can be edited directly; no revision is needed',
	'sales.quotationState.notLatest': 'Only the latest revision can be revised',
	'sales.quotationState.won': 'This quotation already has a sales order',
	'sales.selfApproval': 'Self-approval is not allowed: someone else must approve or reject this quotation',

	'crm.customerNotFound': 'Customer not found',
	'crm.customerCodeTaken': 'Customer code {{code}} is already used',
	'crm.customerAlreadyActive': 'The customer is already active',
	'crm.customerAlreadyInactive': 'The customer is already inactive',
	'crm.villageNotFound': 'Village (kelurahan/desa) not found',
	'crm.contactNotFound': 'Contact not found',
	'crm.leadNotFound': 'Lead not found',
	'crm.leadClosed': 'A converted lead can no longer be changed',
	'crm.leadAlreadyConverted': 'The lead is already converted',
	'crm.leadLostReopenFirst': 'Reopen a lost lead before converting it',
	'crm.leadAssignForbidden': 'Only managers can assign leads',
	'crm.leadAssigneeInvalid': 'The assignee must be a member of this organization with access to leads',
	'crm.leadCustomerUnavailable': 'The customer was not found or is inactive',
	'crm.attachmentNotFound': 'Attachment not found',
	'publicApi.keyRequired': 'API key required',
	'publicApi.keyInvalid': 'Invalid API key',
	'publicApi.rateLimited': 'Too many requests',
	'publicApi.tooManyFiles': 'Attach up to {{max}} files',
	'publicApi.fileTooLarge': 'Each file must be 25 MB or smaller',
	'publicApi.fileType': 'Use PDF, DWG, JPG or PNG files',
	'publicApi.badPayload': 'The payload must be valid JSON',

	'inventory.itemNotFound': 'Item not found',
	'inventory.unitNotFound': 'Item unit not found',
	'inventory.skuTaken': 'An item with this SKU already exists',
	'inventory.categoryNotFound': 'Item category not found',
	'inventory.categorySlugTaken': 'An item category with this slug already exists',
	'inventory.categoryHasItems':
		'Cannot archive a category that still has {{count}} item(s); deactivate it instead',
	'inventory.categoryUnavailable': 'The selected category is not available',
	'inventory.serialTaken': 'An item unit with this serial number already exists',
	'inventory.ruleViolation': 'This inventory rule does not allow it: {{rule}}',
	'inventory.itemHasUnits':
		'Cannot archive an item that still has {{count}} live unit(s)',
	'inventory.warehouseNotFound': 'Warehouse not found',
	'inventory.warehouseCodeTaken':
		'A warehouse with this code already exists in this scope',
	'inventory.warehouseHasUnits':
		'Cannot archive a warehouse that still holds {{count}} live unit(s)',
	'inventory.warehouseLinkConflict':
		'Cannot unlink while the organization holds {{count}} open borrowing(s) originating in this warehouse',
	'inventory.storageNotFound': 'Storage not found',
	'inventory.storageCodeTaken':
		'A storage with this code already exists in this warehouse',
	'inventory.warehouseInactive':
		'Warehouse "{{warehouseCode}}" is inactive; its storages cannot be changed',
	'inventory.warehousePicInvalid':
		'The responsible employee is unknown, inactive, or not from a linked organization',
	'inventory.warehouseManagerExists':
		'This user is already a person in charge of the warehouse',
	'inventory.warehouseManagerUserNotFound': 'User not found',
	'inventory.movementNotFound': 'Stock movement not found',
	'inventory.movementAlreadyReversed':
		'This stock movement has already been reversed',
	'inventory.insufficientStock':
		'Cannot move {{requested}}: only {{available}} on hand',
	'inventory.adjustmentNotFound': 'Stock adjustment not found',
	'inventory.adjustmentCodeTaken':
		'An adjustment with this code already exists in this organization',
	'inventory.adjustmentTransition':
		'An adjustment cannot move from "{{from}}" to "{{to}}"',
	'inventory.selfApprovalForbidden':
		'You cannot approve your own stock adjustment',
	'inventory.adjustmentHasNoLines':
		'A stock adjustment must have at least one line',

	'assets.assetNotFound': 'Asset not found',
	'assets.categoryNotFound': 'Asset category not found',
	'assets.categoryCodeTaken':
		'An asset category with this code already exists',
	'assets.ruleViolation': 'This asset rule does not allow it: {{rule}}',
	'assets.illegalTransition':
		'An asset cannot move from "{{from}}" to "{{to}}"',
	'assets.assetHasHistory':
		'Cannot archive an asset with custody or maintenance history',
	'assets.placeBlocked':
		'This asset cannot be placed in its current status',
	'assets.transferBlocked':
		'This asset cannot be transferred in its current status',
	'assets.periodAlreadyDepreciated':
		'This asset already has a depreciation entry for {{period}}',
	'assets.depreciationExceedsBookValue':
		'Depreciation cannot exceed the remaining book value',
	'assets.toolSetNotEmpty':
		'Cannot archive a tool set that still holds items',

	'user.notFound': 'User not found',
	'user.emailInUse': 'Email already in use',
	'user.globalAdminRequired': 'Global administrator role required',
	'user.fileFieldExpected': 'Expected a multipart file field',
	'user.avatarTooLarge': 'Avatar must be 2 MiB or smaller',
	'user.avatarUnsupportedType': 'Avatar must be a PNG, JPG, WebP or HEIC image',

	'organization.lastOrganization':
		'This is your last organization and cannot be removed',
	'organization.notFound': 'Organization not found',
	'company.profileRequired':
		'Fill in the company profile (with its document code) first',
	'company.settingInvalid': 'The value does not match its type',
	'numbering.unknownCodeType': 'Unknown code type',
	'document.notFound': 'Document not found',
	'document.notVoidable': 'This document cannot be voided',
	'document.fileNotFound': 'File not found',
	'document.shareNotFound': 'This link is invalid or has expired',
	'document.fileNotAllowed': 'A void document cannot take files',
	'document.signatureRequestNotFound': 'Signature request not found',
	'document.signatureRequestState': 'This signature request cannot be acted on',
	'document.notRequestSigner': 'This request is not addressed to you',
	'document.notRequestOwner': 'Only the requester can cancel this request',
	'document.signatureImageNotFound': 'No signature image uploaded',
	'document.signaturePdfInvalid': 'Pick a PDF of this document and upload a PDF',
	'document.signaturePdfState': 'This signature has no signed PDF yet, or it is final',
	'numbering.pattern.length': 'The pattern must be 1-100 characters',
	'numbering.pattern.unknownToken': 'Unknown token {{token}}',
	'numbering.pattern.tokenNotForType':
		'Token {{token}} is only available for: {{types}}',
	'numbering.pattern.tokenTakesNoWidth': 'Token {{token}} does not take a width',
	'numbering.pattern.seqWidth': 'The {SEQ:n} width must be between 1 and 10',
	'numbering.pattern.seqOnce': 'The pattern must contain {SEQ} exactly once',
	'numbering.pattern.braces': 'Unbalanced or malformed token braces',
	'numbering.pattern.literals':
		'Only letters, digits, space, / - . _ are allowed outside tokens',
	'organization.slugTaken': 'Organization slug is already taken',
	'organization.alreadyDeleted': 'Organization is already deleted',
	'organization.notDeleted': 'Organization is not deleted',
	'organization.memberNotFound': 'Member not found',
	'organization.lastOwner': 'Cannot remove or demote the last owner',

	'aftersales.ticketState.comment': 'A closed ticket takes no new messages',
	'portal.stage.preparation': 'Preparation',
	'portal.stage.delivery': 'Delivery',
	'portal.stage.installation': 'Installation',
	'portal.stage.testing': 'Function test',
	'portal.stage.training': 'Training',
	'portal.stage.handover': 'Handover (BAST)',
	'portal.stage.warranty': 'Warranty',
	'portal.label.allDone': 'All tasks done',
	'portal.label.completed': 'Completed {{date}}',
	'portal.label.target': 'Target {{date}}',
	'portal.label.noTarget': 'No target date yet',
	'portal.label.bast': 'Handover certificate (BAST) {{code}}',
	'portal.label.projectManager': 'Project manager',
	'portal.label.you': 'You',
	'portal.label.support': 'Support team',
	'portal.label.resolvedOn': 'Resolved {{date}}',
	'portal.label.warrantyPlan': '{{months}}-month warranty',
	'portal.label.warrantyCertificate': 'Warranty certificate {{code}}',
	'portal.evidence.testing': 'Function test',
	'portal.evidence.training': 'Training',
	'portal.evidence.bast': 'Signed BAST',
	'portal.evidence.photo': 'Photo',
	'portal.ticket.created': 'Ticket created',
	'portal.ticket.resolved': 'Resolved',
	'portal.ticket.closed': 'Closed',
	'portal.businessByInvitation': 'Business accounts are created by invitation. Please contact us.',
	'portal.invalidCode': 'The code is wrong or has expired',
	'portal.ownerOnly': 'Only an account owner can manage members',
	'portal.removeSelf': 'You cannot remove your own access',
	'portal.contactUnavailable': 'The contact is missing or belongs to another customer',
	'portal.role.owner': 'Owner',
	'portal.role.approver': 'Approver',
	'portal.role.finance': 'Finance',
	'portal.role.viewer': 'Viewer',
	'portal.customerUnavailable': 'The customer is missing or inactive',
	'portal.accountExists': 'This customer already has a portal account',
	'portal.emailTaken': 'This email already belongs to another account',
	'portal.accountNotFound': 'Portal account not found',
	'portal.notConfigured': 'The customer portal address (PORTAL_URL) is not configured',
	'portal.invalidCredentials': 'Wrong email or password',
	'portal.locked': 'Too many failed sign-ins. Try again later.',
	'portal.unauthenticated': 'Please sign in to the customer portal',
	'portal.invalidToken': 'This link is invalid or has expired',
	'portal.wrongPassword': 'The current password is wrong',
	'portal.projectNotFound': 'Project not found',
	'portal.productNotFound': 'Device not found',
	'portal.attachmentsUnsupported': 'Attachments are not supported yet; describe the problem in the message',
	'invitation.notFound': 'Invitation not found',
	'invitation.pendingExists': 'A pending invitation already exists for this email',
	'invitation.notPending': 'Invitation is not pending',
	'invitation.claimed':
		'Claimed invitations cannot be deleted; deactivate the user instead',
	'invitation.invalidPayload':
		'Organization invites require both organizationId and roleId',
	'invitation.requiresName': 'Application invites require name',
	'invitation.invalidLink': 'Invitation link is invalid or expired',
	'invitation.alreadyUsed': 'This invitation was already used',
	'invitation.inactive': 'This invitation is no longer active',
	'invitation.expired': 'This invitation link has expired',
	'invitation.bulkLimited': 'Bulk limited to {{max}} rows',
	'invitation.unknownOrganizationSlug': 'No organization has slug "{{slug}}"',
	'invitation.claimUserMissing': 'Invited user no longer exists',
	'invitation.claimAlreadyActive': 'This account is already active',
	'invitation.claimInvalid': 'Invalid claim data',

	'claim.usernameTaken': 'Username is already taken',
	'claim.phoneInUse': 'Phone number is already in use',
	'claim.alreadyInUse': 'Username or email already in use',

	'userAdmin.accountAlreadyActive': 'Account is already active',
	'userAdmin.cannotDeactivate':
		'Cannot deactivate an account that is not active',

	'auth.ownerGrantRequired': 'Only organization owners can grant the owner role',
	'auth.roleNotGrantable': 'Role not grantable: {{roles}}',

	// Borrowing (S4)
	'assets.borrowingNotFound': 'Borrowing not found',
	'assets.borrowingLineNotFound': 'Borrowing line not found',
	'assets.unitNotOnBorrowing': 'That asset is not issued on this borrowing',
	'assets.borrowingTransition':
		'That status change is not allowed for this borrowing',
	'assets.borrowingCodeTaken': 'Could not allocate a unique borrowing code',
	'assets.borrowingHasNoLines': 'A borrowing must have at least one line',
	'assets.unitNotAvailable': 'That asset cannot be issued',
	'assets.borrowerIdentity':
		'The borrower identity does not match the borrower type',
	'assets.guestIdentityIncomplete':
		'A guest borrower is missing required identity data',
	'assets.borrowingSelfApprovalForbidden':
		'You cannot approve your own borrowing',
	'licensing.notFound.application': 'Application not found',
	'licensing.notFound.contract': 'License contract not found',
	'licensing.notFound.key': 'License key not found',
	'licensing.applicationCodeTaken': 'Another application already uses this code',
	'licensing.contract.customer': 'The customer is missing or inactive',
	'licensing.contract.application': 'The application is missing or retired',
	'licensing.contract.order': 'The sales order is missing or belongs to another customer',
	'licensing.contract.dates': 'The end date is before the start date',
	'licensing.contract.startRequired': 'Set the start date before activating',
	'licensing.state.edit': 'Only a draft contract can be edited',
	'licensing.state.activate': 'Only a draft contract can be activated',
	'licensing.state.suspend': 'Only an active contract can be suspended',
	'licensing.state.reactivate': 'Only a suspended contract can be reactivated',
	'licensing.state.terminate': 'This contract is already terminated or renewed',
	'licensing.state.renew': 'Only an active contract can be renewed, once',
	'licensing.state.keys': 'Keys can only be added to a draft, active or suspended contract',
	'licensing.key.required': 'Type the key from the vendor (third-party application)',
	'licensing.key.taken': 'This license key is already registered',
	'licensing.api.missing': 'License API key required',
	'licensing.api.invalid': 'Invalid license API key',
	'licensing.api.rateLimited': 'Too many license API calls; try again in a minute',
	'licensing.refused.unknown': 'Unknown license key',
	'licensing.refused.expired': 'The license has expired',
	'licensing.refused.not_started': 'The license is not active yet',
	'licensing.refused.suspended': 'The license is suspended',
	'licensing.refused.terminated': 'The license is terminated',
	'licensing.refused.revoked': 'The license key is revoked',
	'licensing.refused.seat_limit': 'Every activation of this key is in use',
	'licensing.refused.not_activated': 'This installation is not activated',
	'licensing.apiKey.ownOnly': 'API keys are only for the company’s own, active applications',
	'licensing.apiKey.noOwner': 'The organization has no owner to issue the key',
	'licensing.apiKey.notFound': 'API key not found',
	'licensing.activationNotFound': 'Activation not found or already released',

	// HR (ERP-0034)
	'hr.employeeNotFound': 'Employee not found',
	'hr.companyEmployeeForbidden': 'Company-level employees are managed by application admins only',
	'hr.employeeEmailTaken': 'Another employee already uses this login email or code',
	'hr.employeeInvite': 'The employee invitation failed',
	'hr.notFound.employee': 'Employee not found',
	'hr.notFound.leaveType': 'Leave type not found',
	'hr.notFound.leave': 'Leave request not found',
	'hr.notFound.overtime': 'Overtime record not found',
	'hr.notFound.task': 'Task not found',
	'hr.notFound.salary': 'Salary summary not found',
	'hr.employeeState.inactive': 'The employee is inactive',
	'hr.leave.dates': 'The end date is before the start date',
	'hr.leave.noWorkingDays': 'The range has no working day (Sundays are not counted)',
	'hr.leave.typeInactive': 'This leave type is not active',
	'hr.leave.overlap': 'The employee already has leave in these dates',
	'hr.leave.quota': 'Not enough leave left this year: {{remaining}} day(s) left, {{requested}} requested',
	'hr.requestState.decide': 'Only a submitted request can be approved or rejected',
	'hr.requestState.cancel': 'This request is already rejected or cancelled',
	'hr.selfDecision': 'Someone other than the person who recorded it must decide',
	'hr.salary.locked': 'This salary summary is approved and locked',
	'hr.salary.nothingToApprove': 'This period has no draft summary to approve',
	'hr.salary.netNegative': 'Deductions are larger than the pay',
	'hr.import.type': 'Upload an .xlsx or .csv file',
	'hr.import.size': 'The file is larger than 2 MB',
	'hr.import.empty': 'The file has no data rows',
	'hr.import.tooMany': 'The file has more than 2000 rows',
	'hr.attendanceTimes': 'The check-out time is before the check-in time',

	// Tax (ERP-0016)
	'accounting.taxTypeNotFound': 'Tax type not found',
	'accounting.taxTypeOverlap':
		'Effective period overlaps an existing rate for this tax code',
	'accounting.taxTypeInUse': 'Tax type is still in use',
	'accounting.taxRateNotFound': 'No active tax rate covers this date',
	'accounting.taxRecordNotFound': 'Tax record not found',
	'accounting.taxRecordPeriodTaken':
		'A tax record already exists for this type and period',
	'accounting.taxRecordLocked': 'Tax record is no longer editable',
	'accounting.taxTransition':
		'That status change is not allowed for this record',
	'accounting.withholdingNotFound': 'Withholding record not found',
	'accounting.withholdingLocked': 'Withholding record is no longer editable',
	'accounting.withholdingTransition':
		'That status change is not allowed for this withholding record',

	// Ledger (M09 F2)
	'accounting.accountNotFound': 'Chart of account not found',
	'accounting.accountCodeTaken': 'Account code already exists',
	'accounting.accountInUse':
		'Account is still referenced and cannot be deactivated',
	'accounting.accountNotPostable': 'Journal lines require a postable account',
	'accounting.accountInactive': 'Account is inactive',
	'accounting.periodNotFound': 'Accounting period not found',
	'accounting.periodTaken':
		'An accounting period for this month already exists',
	'accounting.periodLocked': 'The accounting period for this date is closed',
	'accounting.periodTransition':
		'That status change is not allowed for this period',
	'accounting.journalEntryNotFound': 'Journal entry not found',
	'accounting.journalUnbalanced':
		'Journal entry is not balanced: debits must equal credits',
	'accounting.journalLineSide':
		'Each journal line must carry exactly one of debit or credit',
	'accounting.journalDuplicate':
		'A posted journal entry with this idempotency key already exists',
	'accounting.journalTransition':
		'That status change is not allowed for this journal entry',
	'accounting.journalAlreadyReversed':
		'Journal entry has already been reversed',
	'accounting.reversalPeriodLocked':
		'The reversal would fall in a closed period; reopen it first',

	// Ledger F3
	'accounting.openingBalanceAlreadyPosted':
		'Opening balances were already posted and cannot be changed; correct through a journal reversal',
	'accounting.openingBalanceLocked':
		'Opening balance row not found or not editable',
	'accounting.cashBankAccountNotFound': 'Cash/bank account not found',
	'accounting.cashBankAccountCodeTaken':
		'Cash/bank account code already exists',
	'accounting.cashBankAccountInactive': 'Cash/bank account is inactive',
	'accounting.cashBankLinkRequired':
		'Cash/bank account has no general-ledger account link; add one before posting movements',
	'accounting.cashBankTransactionNotFound':
		'Cash/bank transaction not found',
	'accounting.cashBankInsufficientFunds':
		'Insufficient balance on the cash/bank account',

	// Invoices & AR (F4)
	'accounting.arAccountNotConfigured':
		'No active general-ledger account is configured for this posting role; set up the chart of accounts first',
	'accounting.openItemNotFound': 'The open-item sub-ledger row for this document is missing',
	'accounting.paymentNotFound': 'Payment not found',
	'accounting.paymentInvalidTransition':
		'That status change is not allowed for this payment',
	'accounting.paymentVoidNotAllowed':
		'Executed payments cannot be voided here; correct through a period-end adjustment instead',
	'accounting.paymentAllocationMismatch':
		'Allocations must add up exactly to the payment amount',
	'accounting.paymentOverAllocation':
		'Allocation exceeds the invoice outstanding amount',
	'accounting.paymentTargetNotIssued':
		'Allocations may only target issued or partially paid invoices',
	'accounting.paymentCashAccountRequired':
		'A cash/bank account is required to execute this payment',
	'accounting.billNotFound': 'Supplier bill not found',
	'accounting.billNotDraft':
		'Only draft supplier bills can be modified or recorded',
	'accounting.bankReconciliationNotFound': 'Bank reconciliation not found',
	'accounting.bankReconciliationState':
		'That reconciliation action is not allowed for this document',
	'accounting.reportPeriodInvalid': 'Report date range is invalid',
	'accounting.reportArchiveNotFound': 'Report archive not found',
	'accounting.reportArchivePeriodOpen':
		'That period is still open; close it before archiving',

	// Invoices (F4) — sales keys
	'sales.invoiceOrderUnavailable': 'The sales order is missing or cancelled',
	'sales.invoiceTerm.fullyInvoiced': 'The order is fully invoiced',
	'sales.invoiceTerm.empty': 'The term amount must be more than zero',
	'sales.invoiceTerm.exceeds': 'The term is more than what is left to invoice',
	'sales.invoiceTerm.noPlannedTerm': 'No planned term is left',
	'sales.invoiceNotVoidable': 'Only an unpaid draft or issued invoice can be voided. Reverse its receipts first.',
	'sales.invoiceNotFound': 'Invoice not found',
	'sales.invoiceNotDraft': 'Only draft invoices can be modified or issued',
	'sales.invoiceNoItems':
		'Invoices need at least one line item to be issued',
	'sales.invoiceDueBeforeIssue':
		'Due date cannot be before the issue date',
	'sales.receiptNotFound': 'Receipt not found',
	'sales.receiptExceeds':
		'The payment exceeds the outstanding amount',
	'sales.receiptReversed': 'The receipt is already reversed',
	'sales.invoiceNotPayable':
		'Only issued or partially paid invoices can receive payments',
	'sales.gatewayNotConfigured': 'Online payment is not configured',
	'sales.gatewayProviderUnknown': 'Unknown payment provider',
	'sales.gatewayProvider': 'The payment provider did not accept the request',
	'sales.gatewayWebhookUnauthorized': 'Invalid webhook signature',
	'automation.outboxNotFound': 'Event not found',
	'automation.whatsappNotFound.conversation': 'Chat not found',
	'automation.whatsappNotFound.message': 'Message not found',
	'automation.whatsappNotFound.faq': 'FAQ entry not found',
	'automation.whatsappWebhook.notConfigured': 'The WhatsApp webhook key is not configured on the server',
	'automation.whatsappWebhook.badSignature': 'Invalid webhook signature',
	'automation.whatsappState.resume': 'The assistant already answers this chat',
	'automation.whatsappState.close': 'The chat is already closed',
	'automation.whatsappRetry': 'Only a failed outgoing message can be sent again',
	'catalog.notFound.listing': 'Listing not found',
	'catalog.notFound.product': 'Product not found',
	'catalog.listing.slug': 'Another listing already uses this slug',
	'catalog.listing.item': 'This item already has a listing',
	'catalog.listing.itemUnavailable': 'The item is archived or inactive',
	'catalog.listing.noPrice': 'The item has no selling price; use quotation pricing',

	'notification.notFound': 'Notification not found',
} as const;

export default api;
