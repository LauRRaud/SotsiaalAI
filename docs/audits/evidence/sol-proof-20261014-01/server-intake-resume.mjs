import fs from 'node:fs';
import assert from 'node:assert/strict';
import {httpHarness,recorder} from './server-http-support.mjs';
const root=process.argv[2],{prisma,actors,call,login}=await httpHarness(root);
const fixture=JSON.parse(fs.readFileSync('intake-fixture.json','utf8'));
const prior=JSON.parse(fs.readFileSync('server-intake-flow.json','utf8'));
const {rec,save,check}=recorder(root,'server-intake-resume');
const oid=fixture.organizationId,iid=prior.created.inboxItemId,aid=prior.created.assignmentId,pid=prior.created.inquiryId,orgPath=`/api/org/${oid}`;
rec.limits=['Continuation reuses the same receipt, assignment and created room after harness HTTP 201 mismatch.','Synthetic OTHER organization; provider test actor is the replacement worker. No two-social-worker human validation is claimed.'];
try{
 const organization=await prisma.organization.findUnique({where:{id:oid},select:{displayName:true,createdByUserId:true}});
 assert.ok(organization?.displayName?.startsWith('SOL TEST'));assert.equal(organization.createdByUserId,actors.provider.id);
 const inquiry=await prisma.preInquiry.findUnique({where:{id:pid},select:{authorId:true,recipientOrganizationId:true}});
 assert.equal(inquiry.authorId,actors.client.id);assert.equal(inquiry.recipientOrganizationId,oid);
 const room=await prisma.room.findFirst({where:{originId:pid},select:{id:true}});assert.ok(room?.id,'Existing room from first attempt is required');const rid=room.id;rec.created.roomId=rid;
 await prisma.organization.update({where:{id:oid},data:{status:'ACTIVE',suspendedAt:null,suspendedReason:null}});
 for(const key of Object.keys(actors))await login(key);
 const handed=await call('specialist',`${orgPath}/assignments/${aid}`,'POST',{toMembershipId:fixture.coordinatorMembershipId,reason:'SOL TEST worker handover'});
 assert.equal(handed.status,201,JSON.stringify(handed.data));const bid=handed.data.assignment.id;rec.created.handoverAssignmentId=bid;save();
 const oldNow=await call('specialist',`${orgPath}/inbox/${iid}`),newPending=await call('provider',`${orgPath}/inbox/${iid}`);
 check('OPS-02','handover_clears_old_access_and_requires_new_accept',oldNow.status===404&&newPending.data?.item?.status==='ASSIGNED'&&newPending.data.item.assignment.status==='PENDING'&&newPending.data.item.room.canOpen===false,{oldWorkerStatus:oldNow.status,newInboxStatus:newPending.data?.item?.status,newAssignmentStatus:newPending.data?.item?.assignment?.status,newRoomBeforeAcceptance:newPending.data?.item?.room});
 const oldRoom=await call('specialist',`/api/rooms/${rid}/messages`);
 check('DATA-01','old_worker_room_content_denied_after_handover',[403,404].includes(oldRoom.status),{status:oldRoom.status});
 const bAccept=await call('provider',`${orgPath}/assignments/${bid}`,'PATCH',{action:'accept'});assert.equal(bAccept.status,200,JSON.stringify(bAccept.data));
 const bView=await call('provider',`${orgPath}/inbox/${iid}`),bRoom=await call('provider',`/api/rooms/${rid}/messages`);
 check('OPS-02','new_worker_gets_same_room_after_acceptance',bView.data?.item?.status==='ACCEPTED'&&bView.data.item.room.id===rid&&bRoom.status===200,{inboxStatus:bView.data?.item?.status,roomId:bView.data?.item?.room?.id,sameRoom:bView.data?.item?.room?.id===rid,messagesStatus:bRoom.status});
 const ended=await call('provider',`${orgPath}/members/${fixture.workerMembershipId}`,'DELETE',{reason:'SOL TEST completed handover; old worker leaves'});
 const stale=await call('specialist',orgPath+'/inbox'),personal=await call('specialist','/api/journeys');
 check('OPS-02','ended_member_old_session_denied_personal_account_survives',ended.status===200&&stale.status===404&&personal.status===200,{endStatus:ended.status,membershipStatus:ended.data?.membership?.status,oldSessionOrgStatus:stale.status,personalStatus:personal.status});
 const note='SOL TEST: kokkulepitud juhendamine lõpetatud; järgmine samm on oma seadme iseseisev kasutamine.';
 const closed=await call('provider',`${orgPath}/inbox/${iid}`,'PATCH',{toStatus:'CLOSED',reason:note});
 const client=await call('client',`/api/pre-inquiries/${pid}`);
 check('OPS-08','closed_outcome_reaches_client',closed.status===200&&client.status===200&&client.data?.inquiry?.organizationOutcome?.note===note&&!!client.data.inquiry.organizationOutcome.at,{closeStatus:closed.status,outcome:client.data?.inquiry?.organizationOutcome});
 const liveCount=await prisma.organizationWorkAssignment.count({where:{inboxItemId:iid,status:{in:['PENDING','ACCEPTED']}}});
 const reassigned=await call('provider',`${orgPath}/inbox/${iid}/assign`,'POST',{assigneeMembershipId:fixture.coordinatorMembershipId});
 check('OPS-08','closed_work_has_no_live_assignment_or_new_assignment',liveCount===0&&reassigned.status===409,{liveCount,assignStatus:reassigned.status,message:reassigned.data?.message});
 rec.observations=[{case_id:'OPS-03',variant_id:'deadline_not_established',actual:await prisma.organizationInboxItem.findUnique({where:{id:iid},select:{receivedAt:true,dueAt:true,lastTransitionAt:true}}),status:'NOT_PROVEN',note:'Receipt/acceptance transitions did not establish dueAt. No legal 7/10-day rule is inferred.'}];
}finally{
 const current=await prisma.organization.findUnique({where:{id:oid},select:{displayName:true,createdByUserId:true}});
 if(current?.displayName?.startsWith('SOL TEST')&&current.createdByUserId===actors.provider.id){await prisma.organization.update({where:{id:oid},data:{status:'SUSPENDED',suspendedAt:new Date(),suspendedReason:'SOL TEST bounded execution finished; preserve fixture'}});rec.fixtureFinalStatus='SUSPENDED';}
 rec.finishedAt=new Date().toISOString();save();await prisma.$disconnect();console.log(JSON.stringify({checks:rec.checks.length,pass:rec.checks.filter(c=>c.status==='PASS').length,nonpassing:rec.checks.filter(c=>c.status!=='PASS'),created:rec.created,fixtureFinalStatus:rec.fixtureFinalStatus}));
}
